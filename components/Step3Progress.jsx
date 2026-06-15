'use client';

import { useEffect, useRef, useState } from 'react';

const IMAGE_CONCURRENCY = 4;
const TEXT_BATCH_SIZE = 8;
const MAX_RETRIES = 3;
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 80; // 80 * 3s = 4 分鐘 timeout

/**
 * 安全 fetch JSON:
 * - 非 JSON 回應視為 transient error,可重試
 * - 5xx / 4xx 也丟錯,給上層決定要不要重試
 */
async function safeFetchJSON(url, body, { retries = MAX_RETRIES, label = '', method = 'POST' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const opts = { method, headers: { 'content-type': 'application/json' } };
      if (method === 'POST' && body !== undefined) opts.body = JSON.stringify(body);
      const res = await fetch(url, opts);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`${label} 回應不是 JSON (HTTP ${res.status}): ${text.slice(0, 80)}`);
      }
      if (!res.ok) throw new Error(data.error || `${label} HTTP ${res.status}`);
      return data;
    } catch (e) {
      lastErr = e;
      // exponential backoff: 1s, 2s, 4s
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

/**
 * 3 步驟生圖:submit (拿 taskId) → poll (輪詢直到完成) → finalize (下載+上傳 Cloudinary)
 * 每個 endpoint 都 <30s,絕對不會被 Vercel 60s 砍
 */
async function genImageChunked({ prompt, refs, brand, aspect_ratio = '1:1', cancelRef }) {
  // (1) submit
  const sub = await safeFetchJSON('/api/gen-image/submit', {
    prompt, referenceImages: refs, aspect_ratio,
  }, { label: 'gen-image/submit', retries: 2 });
  const taskId = sub.taskId;
  if (!taskId) throw new Error('submit 沒回 taskId');

  // (2) poll
  let kieUrl = null;
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    if (cancelRef?.current) throw new Error('cancelled');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    let p;
    try {
      p = await safeFetchJSON(`/api/gen-image/poll?taskId=${taskId}`, undefined, {
        label: 'gen-image/poll', retries: 2, method: 'GET',
      });
    } catch (e) {
      continue; // 單次 poll 失敗不致命,下輪再試
    }
    if (p.state === 'success' && p.kieUrl) { kieUrl = p.kieUrl; break; }
    if (p.state === 'fail') throw new Error(p.error || 'KIE 生成失敗');
  }
  if (!kieUrl) throw new Error('生圖輪詢逾時 (>4 分鐘)');

  // (3) finalize:下載 + 上傳 Cloudinary
  const fin = await safeFetchJSON('/api/gen-image/finalize', { kieUrl, brand }, {
    label: 'gen-image/finalize', retries: 2,
  });
  return { url: fin.url };
}

export default function Step3Progress({ input, themes, onDone, onBack }) {
  const [themeProgress, setThemeProgress] = useState(
    () => themes.map((t) => ({ name: t.name, type: t.type, target: t.monthly_count || 30, done: false, count: 0, error: null }))
  );
  const [textXlsxUrl, setTextXlsxUrl] = useState(null);
  // phase: 'text' | 'images' | 'review' | 'finalizing' | 'done' | 'error'
  // review = 圖片全跑完,等待用戶刪/重生/確認
  const [phase, setPhase] = useState('text');
  const [error, setError] = useState('');
  const [imageState, setImageState] = useState({ total: 0, done: 0, images: [] });
  const [postsByThemeState, setPostsByThemeState] = useState({});
  const [regenerating, setRegenerating] = useState(false);
  const startedRef = useRef(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run().catch((e) => {
      setError(e.message);
      setPhase('error');
    });
    return () => {
      // 注意:不要 cancel ref,否則 strict mode 雙跑會打架
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cancel() {
    cancelRef.current = true;
    setError('使用者已取消');
    setPhase('error');
  }

  async function run() {
    // ===== Phase 1: 文字 (每個主題分批 chunked,每 call ≤ 8 篇) =====
    const postsByTheme = {};
    for (let i = 0; i < themes.length; i++) {
      if (cancelRef.current) return;
      const theme = themes[i];
      const target = theme.monthly_count || 30;
      setThemeProgress((arr) => arr.map((s, idx) => idx === i ? { ...s, active: true } : s));

      const accumulated = [];
      const previousTitles = [];
      let themeError = null;

      while (accumulated.length < target) {
        if (cancelRef.current) return;
        const remaining = target - accumulated.length;
        const batchCount = Math.min(TEXT_BATCH_SIZE, remaining);
        try {
          const data = await safeFetchJSON('/api/gen-text', {
            input,
            theme,
            count: batchCount,
            previousTitles,
            startIndex: accumulated.length,
          }, { label: `gen-text(${theme.name})`, retries: MAX_RETRIES });

          accumulated.push(...(data.posts || []));
          previousTitles.push(...(data.titles || []));
          setThemeProgress((arr) => arr.map((s, idx) =>
            idx === i ? { ...s, count: accumulated.length } : s
          ));
        } catch (e) {
          themeError = e.message;
          break;
        }
      }

      postsByTheme[theme.name] = accumulated;
      setThemeProgress((arr) => arr.map((s, idx) =>
        idx === i ? { ...s, done: !themeError, active: false, count: accumulated.length, error: themeError } : s
      ));
    }

    if (cancelRef.current) return;

    // ===== 早期 finalize: 文字版 xlsx =====
    setPhase('images');
    try {
      const d = await safeFetchJSON('/api/finalize-xlsx',
        { input, themes, postsByTheme },
        { label: 'finalize-text', retries: 2 });
      if (d.download_url || d.id) {
        setTextXlsxUrl(d.download_url || `/api/download/${d.id}`);
      }
    } catch (_) {}

    // ===== Phase 2: 圖片 (並行) =====
    // dry_run 模式下也產 mock 圖片 task,用 placeholder URL,讓 review UI 可測
    const wantImages = input.generate_images !== false;
    const imageTasks = wantImages ? collectImageTasks(themes, postsByTheme, input) : [];

    if (imageTasks.length === 0) {
      // 沒圖,直接結束
      const d = await safeFetchJSON('/api/finalize-xlsx',
        { input, themes, postsByTheme },
        { label: 'finalize-final', retries: 2 });
      onDone({
        id: d.id,
        download_url: d.download_url,
        file_size: d.file_size,
        themes_summary: buildSummary(themes, postsByTheme),
      });
      setPhase('done');
      return;
    }

    // 初始化每張為 pending,task meta 保留供 regenerate 用
    const initialImages = imageTasks.map((t, idx) => ({
      id: `img-${idx}`,
      themeName: t.themeName,
      postIndex: t.postIndex,
      prompt: t.prompt,
      refs: t.refs,
      url: null,
      status: 'pending',
      error: null,
    }));
    setImageState({ total: imageTasks.length, done: 0, images: initialImages });

    // 並行 pool
    let cursor = 0;
    async function worker() {
      while (true) {
        if (cancelRef.current) return;
        const idx = cursor++;
        if (idx >= imageTasks.length) return;
        const t = imageTasks[idx];

        // dry-run: 用 placeholder picsum URL,跳過實際 KIE
        if (input.dry_run) {
          await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));
          const mockUrl = `https://picsum.photos/seed/${encodeURIComponent(t.themeName + idx)}/400/400`;
          const post = postsByTheme[t.themeName]?.[t.postIndex];
          if (post) post.AI圖 = mockUrl;
          setImageState((s) => ({
            ...s,
            done: s.done + 1,
            images: s.images.map((img, i) => i === idx ? { ...img, url: mockUrl, status: 'success' } : img),
          }));
          continue;
        }

        try {
          const d = await genImageChunked({
            prompt: t.prompt,
            refs: t.refs,
            brand: input.brand,
            aspect_ratio: '1:1',
            cancelRef,
          });
          const post = postsByTheme[t.themeName]?.[t.postIndex];
          if (post) post.AI圖 = d.url;
          setImageState((s) => ({
            ...s,
            done: s.done + 1,
            images: s.images.map((img, i) => i === idx ? { ...img, url: d.url, status: 'success' } : img),
          }));
        } catch (e) {
          setImageState((s) => ({
            ...s,
            done: s.done + 1,
            images: s.images.map((img, i) => i === idx ? { ...img, error: e.message, status: 'failed' } : img),
          }));
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, imageTasks.length) }, worker));

    if (cancelRef.current) return;

    // 跑完不直接 finalize,進入 review 階段讓用戶選刪/重生/確認
    setPostsByThemeState(postsByTheme);
    setPhase('review');
  }

  /**
   * Review 階段:用戶刪除某張圖
   */
  function handleDelete(imgId) {
    setImageState((s) => ({
      ...s,
      images: s.images.map((img) => img.id === imgId
        ? { ...img, status: 'deleted', url: null }
        : img),
    }));
    // 同步清掉 post.AI圖
    const img = imageState.images.find((x) => x.id === imgId);
    if (img) {
      const post = postsByThemeState[img.themeName]?.[img.postIndex];
      if (post) post.AI圖 = '';
    }
  }

  /**
   * 重新生成:對所有 status='deleted' 的圖再跑 KIE
   */
  async function handleRegenerateDeleted() {
    const toRegen = imageState.images.filter((img) => img.status === 'deleted');
    if (toRegen.length === 0) return;
    setRegenerating(true);

    // 標記 regenerating
    const ids = new Set(toRegen.map((i) => i.id));
    setImageState((s) => ({
      ...s,
      images: s.images.map((img) => ids.has(img.id)
        ? { ...img, status: 'regenerating', error: null }
        : img),
    }));

    // 並行跑
    let cursor = 0;
    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= toRegen.length) return;
        const t = toRegen[idx];

        // dry-run: mock URL
        if (input.dry_run) {
          await new Promise((r) => setTimeout(r, 200 + Math.random() * 400));
          const mockUrl = `https://picsum.photos/seed/${encodeURIComponent(t.themeName + t.id + Date.now())}/400/400`;
          const post = postsByThemeState[t.themeName]?.[t.postIndex];
          if (post) post.AI圖 = mockUrl;
          setImageState((s) => ({
            ...s,
            images: s.images.map((img) => img.id === t.id ? { ...img, url: mockUrl, status: 'success' } : img),
          }));
          continue;
        }

        try {
          const d = await genImageChunked({
            prompt: t.prompt,
            refs: t.refs,
            brand: input.brand,
            aspect_ratio: '1:1',
            cancelRef,
          });
          const post = postsByThemeState[t.themeName]?.[t.postIndex];
          if (post) post.AI圖 = d.url;
          setImageState((s) => ({
            ...s,
            images: s.images.map((img) => img.id === t.id ? { ...img, url: d.url, status: 'success' } : img),
          }));
        } catch (e) {
          setImageState((s) => ({
            ...s,
            images: s.images.map((img) => img.id === t.id ? { ...img, status: 'deleted', error: e.message } : img),
          }));
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, toRegen.length) }, worker));
    setRegenerating(false);
  }

  /**
   * 用戶確定下載:呼叫 finalize-xlsx
   * 被刪/失敗的圖 → 對應的 post 整列從 postsByTheme 拿掉(不只是清 AI圖 欄)
   * 同時調整 themes 的 monthly_count 反映實際數量,讓排程時間正確
   */
  async function handleConfirmDownload() {
    setPhase('finalizing');

    // 收集要拿掉的 (themeName, postIndex) 配對
    const toRemove = new Set();
    for (const img of imageState.images) {
      if (img.status !== 'success') {
        toRemove.add(`${img.themeName}#${img.postIndex}`);
      }
    }

    // 從 postsByTheme 過濾掉刪除的 post (整列 row 刪除)
    const filteredPosts = {};
    for (const [themeName, posts] of Object.entries(postsByThemeState)) {
      filteredPosts[themeName] = posts.filter((_, idx) => !toRemove.has(`${themeName}#${idx}`));
    }

    // 調整 themes 的 monthly_count 對應實際 post 數量
    const adjustedThemes = themes.map((t) => ({
      ...t,
      monthly_count: filteredPosts[t.name]?.length ?? t.monthly_count,
    }));

    try {
      const finalData = await safeFetchJSON('/api/finalize-xlsx',
        { input, themes: adjustedThemes, postsByTheme: filteredPosts },
        { label: 'finalize-final', retries: 2 });

      onDone({
        id: finalData.id,
        download_url: finalData.download_url,
        file_size: finalData.file_size,
        themes_summary: buildSummary(adjustedThemes, filteredPosts),
      });
      setPhase('done');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  const textDone = themeProgress.filter((s) => s.done).length;
  const totalText = themeProgress.reduce((s, x) => s + x.count, 0);
  const totalTarget = themeProgress.reduce((s, x) => s + x.target, 0);

  return (
    <div className="space-y-5">
      {/* ===== 文字進度 ===== */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            📝 文字生成 {totalText}/{totalTarget} 篇 · {textDone}/{themes.length} 主題
            {phase !== 'text' && ' ✓'}
          </h2>
          <button onClick={cancel} className="text-sm text-stone-500 hover:text-red-600">
            取消
          </button>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${totalTarget > 0 ? (totalText / totalTarget) * 100 : 0}%` }}
          />
        </div>

        <ul className="space-y-1.5">
          {themeProgress.map((s, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                s.active ? 'bg-brand-50' : ''
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs ${
                  s.done
                    ? 'bg-brand-500 text-white'
                    : s.active
                    ? 'animate-pulse bg-stone-900 text-white'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {s.done ? '✓' : i + 1}
              </span>
              <span className="flex-1 font-medium text-stone-800">{s.name}</span>
              <span className="text-xs text-stone-500">
                {s.count}/{s.target}
                {s.error && <span className="ml-2 text-red-600">⚠ {s.error.slice(0, 40)}</span>}
              </span>
            </li>
          ))}
        </ul>

        {textXlsxUrl && phase === 'images' && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-green-800">
                ✓ 文字版 xlsx 已可下載（圖片還在生成中）
              </span>
              <a
                href={textXlsxUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
              >
                先下載文字版
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ===== 圖片進度 (跑中) ===== */}
      {imageState.total > 0 && phase === 'images' && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              🎨 圖片生成 {imageState.done}/{imageState.total}
            </h2>
            <span className="text-xs text-stone-500">並行 {IMAGE_CONCURRENCY} 個</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full bg-purple-500 transition-all"
              style={{ width: `${(imageState.done / imageState.total) * 100}%` }}
            />
          </div>

          {imageState.images.filter((img) => img.url || img.error).length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {/* 顯示所有已完成的圖,不再 slice(-12) — 大量生圖時前面也看得到 */}
              {imageState.images.filter((img) => img.url || img.error).map((img) => (
                <ImageTile key={img.id} img={img} compact />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== 圖片管理 (review 階段) ===== */}
      {phase === 'review' && imageState.total > 0 && (
        <ImageReviewPanel
          images={imageState.images}
          onDelete={handleDelete}
          onRegenerate={handleRegenerateDeleted}
          onConfirm={handleConfirmDownload}
          regenerating={regenerating}
        />
      )}

      {phase === 'finalizing' && (
        <div className="card text-center">
          <p className="text-stone-700">📦 組裝 xlsx 中…</p>
        </div>
      )}

      {error && (
        <div className="card border-red-200 bg-red-50">
          <p className="text-sm text-red-700">❌ {error}</p>
          <button onClick={onBack} className="mt-2 text-xs text-red-600 underline">
            返回主題編輯
          </button>
        </div>
      )}
    </div>
  );
}

function ImageTile({ img, compact = false, onDelete }) {
  const isDeleted = img.status === 'deleted';
  const isRegen = img.status === 'regenerating';
  const isPending = img.status === 'pending';

  return (
    <div
      className={`relative overflow-hidden rounded-lg border ${
        isDeleted ? 'border-red-300 bg-red-50' :
        isRegen ? 'border-amber-300 bg-amber-50' :
        'border-stone-200'
      }`}
    >
      {(isPending || isRegen) ? (
        <div className="flex aspect-square items-center justify-center bg-stone-50 text-xs text-stone-500">
          {isRegen ? '🔄 重新生成中…' : '⏳ 等待中'}
        </div>
      ) : img.error && !img.url ? (
        <div className="flex aspect-square items-center justify-center bg-red-50 p-2 text-center text-[10px] text-red-600">
          ⚠ {img.error?.slice(0, 30)}
        </div>
      ) : isDeleted ? (
        <div className="flex aspect-square items-center justify-center bg-stone-100 text-center text-xs text-stone-500">
          🗑 已刪除
        </div>
      ) : (
        <a href={img.url} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={`${img.themeName} #${img.postIndex + 1}`}
            className="aspect-square w-full object-cover"
            loading="lazy"
          />
        </a>
      )}

      {!compact && onDelete && img.status === 'success' && (
        <button
          type="button"
          onClick={() => onDelete(img.id)}
          className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-red-600"
          title="刪除這張"
        >
          ×
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[10px] text-white">
        #{img.postIndex + 1}
      </div>
    </div>
  );
}

function ImageReviewPanel({ images, onDelete, onRegenerate, onConfirm, regenerating }) {
  const success = images.filter((i) => i.status === 'success').length;
  const deleted = images.filter((i) => i.status === 'deleted').length;
  const failed = images.filter((i) => i.status === 'failed').length;

  const byTheme = images.reduce((acc, img) => {
    if (!acc[img.themeName]) acc[img.themeName] = [];
    acc[img.themeName].push(img);
    return acc;
  }, {});

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">
          🎨 圖片管理（生成完成，請預覽 / 刪除 / 確認）
        </h2>
        <span className="text-xs text-stone-500">
          ✓ {success} · 🗑 {deleted} · ⚠ {failed}
        </span>
      </div>

      <p className="rounded-lg bg-stone-50 px-4 py-2 text-xs text-stone-600">
        💡 每張圖右上角「×」=刪除整列（連對應的文案也會從 xlsx 拿掉，不是只刪圖）。
        不滿意刪掉後按下方「重新生成」會用原 prompt 再跑一輪。確認後「下載 xlsx」才會封檔。
      </p>
      <p className="rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
        ⚠ 失敗 (⚠) 的圖也會被視為刪除狀態,確定下載後那幾列不會出現在 xlsx。可以先按重新生成救回來。
      </p>

      <div className="space-y-5">
        {Object.entries(byTheme).map(([themeName, imgs]) => {
          const okCount = imgs.filter((i) => i.status === 'success').length;
          return (
            <div key={themeName}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-stone-800">
                  {themeName}
                </h3>
                <span className="text-xs text-stone-500">
                  {okCount}/{imgs.length} 保留
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {imgs.map((img) => (
                  <ImageTile key={img.id} img={img} onDelete={onDelete} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
        <div className="text-xs text-stone-500">
          {deleted > 0
            ? `${deleted} 張被刪除,可重新生成或直接下載 (留空 AI圖 欄)`
            : '可以直接下載最終版'}
        </div>
        <div className="flex gap-2">
          {deleted > 0 && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
            >
              {regenerating ? '🔄 重新生成中…' : `🔄 重新生成 ${deleted} 張`}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={regenerating}
            className="btn-primary"
          >
            ✓ 確定下載 xlsx
          </button>
        </div>
      </div>
    </div>
  );
}

function collectImageTasks(themes, postsByTheme, input) {
  const tasks = [];
  for (const theme of themes) {
    if (theme.type !== 'product_with_image') continue;
    const posts = postsByTheme[theme.name] || [];
    posts.forEach((post, pIdx) => {
      const pi = Number.isInteger(post.product_index) && post.product_index >= 0
        && post.product_index < input.products.length
          ? post.product_index : 0;
      const product = input.products[pi];
      // 跳過未勾選「生圖」的 SKU (防呆,理論上 prompt 已限制 enabled SKU,但雙保險)
      if (product?.include_in_image_gen === false) return;

      // 風格決定: 優先用 SKU 啟用的風格;若 theme.image_style 在 SKU 允許清單內就用它,
      //          否則從 SKU 允許風格隨機挑一個
      const skuStyles = enabledStyles(product);
      const themeStyle = theme.image_style;
      const chosenStyle = (themeStyle && skuStyles.includes(themeStyle))
        ? themeStyle
        : skuStyles[Math.floor(Math.random() * skuStyles.length)];

      const prompt = buildImagePrompt(post, input, product, { ...theme, image_style: chosenStyle });
      if (!prompt) return;
      const productRefs = pickRefs(product?.images && product.images.length > 0 ? product.images : []);
      const logoRefs = Array.isArray(input.brand_logos) && input.brand_logos.length > 0
        ? [input.brand_logos[0]]
        : [];
      const refs = [...productRefs, ...logoRefs].slice(0, 4);
      tasks.push({
        themeName: theme.name,
        postIndex: pIdx,
        prompt,
        refs,
      });
    });
  }
  return tasks;
}

function enabledStyles(productOrInput) {
  const s = productOrInput?.image_styles || {};
  const out = [];
  if (s.scene) out.push('scene');
  if (s.character) out.push('character');
  if (s.product) out.push('product');
  if (s.ecommerce) out.push('ecommerce');
  return out.length > 0 ? out : ['product'];
}

function buildImagePrompt(post, input, product, theme) {
  const keywords = post['Prompt核心關鍵字'] || post['Prompt 核心關鍵字'] || '';
  const main = post['主標題'] || post['首句Hook'] || '';
  const sub = post['副標題'] || post['切入點'] || '';
  const persona = input.brand_persona || '';
  if (!keywords && !main) return null;

  // 圖片風格指令
  const chosenStyle = theme?.image_style || 'product';
  const promoOffer = (product?.promo_offer || '').trim();
  const styleInstr = {
    scene: 'Lifestyle scene / environmental composition. People may be peripheral; focus on the environment around the product.',
    character: 'Include a model or character interacting with the product. Show usage, expression, emotional connection.',
    product: 'Product-focused close-up. Minimal human presence. Clean composition spotlighting the product.',
    ecommerce: `E-commerce promotional layout: prominent price tag / discount badge / limited-time banner / clear CTA area, conversion-oriented composition${promoOffer ? `. Promo content to show on graphic: "${promoOffer}"` : ''}.`,
  }[chosenStyle];

  // 該 SKU 自訂的視覺強化方向 (optional)
  const focus = (product?.image_focus || '').trim();
  const focusInstr = focus ? `Strengthen visual emphasis on: ${focus}.` : '';

  // LOGO 處理
  const hasLogo = Array.isArray(input.brand_logos) && input.brand_logos.length > 0;
  const logoInstr = hasLogo
    ? 'A brand logo reference is provided. You MAY include the logo subtly in a corner. Do NOT distort or invent variations.'
    : 'STRICT: NO brand logo of any kind. NO brand name as text overlay. NO invented logos, badges, or branded text. Keep the composition logo-free.';

  // Avoid 清單
  const avoidArr = Array.isArray(input.avoid_terms) ? input.avoid_terms : [];
  const avoidInstr = avoidArr.length > 0
    ? `STRICT NEGATIVE — must NOT appear (including variations / synonyms / implications): ${avoidArr.join(', ')}.`
    : '';

  // 嚴格保留產品原貌
  const fidelityInstr = 'CRITICAL PRODUCT FIDELITY: Preserve the EXACT original colors, shape, packaging, label artwork, and any visible logos or text printed on the product. Do NOT recolor, alter, or restyle the product in any way. Only the background/composition/style around it may change.';

  // 最強制:絕對禁止新包裝 (hard rule)
  const noNewPackagingInstr = 'ABSOLUTELY FORBIDDEN — HARD RULE: Under NO circumstances may you invent, redesign, replace, modify, or stylize the product packaging. The packaging in the output image MUST be pixel-faithful to the reference. Do NOT create new packaging variants. Do NOT redraw labels. Do NOT swap container shapes. If you cannot keep the packaging identical, output the product as-is from the reference rather than imagining a new one. This rule overrides any other creative direction.';

  return [
    product?.name && `SKU: ${product.name}`,
    keywords,
    main && `Main text: "${main}"`,
    sub && `Sub: "${sub}"`,
    `Brand vibe: ${input.brand}, ${persona.slice(0, 60)}`,
    styleInstr,
    focusInstr,
    fidelityInstr,
    noNewPackagingInstr,
    logoInstr,
    avoidInstr,
    'Photorealistic, social media post style, vibrant lighting',
  ].filter(Boolean).join('. ');
}

function pickRefs(images) {
  if (!Array.isArray(images) || images.length === 0) return [];
  const shuffled = [...images].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

function buildSummary(themes, postsByTheme) {
  return themes.map((t) => ({
    name: t.name,
    type: t.type,
    type_label: TYPE_LABELS[t.type] || t.type,
    count: (postsByTheme[t.name] || []).length,
    target: t.monthly_count || 30,
    failures: 0,
  }));
}

const TYPE_LABELS = {
  product_with_image: '產品介紹（含圖）',
  product_with_url: '產品介紹（帶網址）',
  opinion_short: '觀點短文',
  brand_quote: '品牌語錄',
  tutorial: '教學小知識',
  quiz: '心理測驗',
  engagement: '高互動引戰',
  persona_narrative: '情境角色文',
};
