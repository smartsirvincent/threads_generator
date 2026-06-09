'use client';

import { useState } from 'react';

const IMAGE_CONCURRENCY = 4;

export default function BuTuPage() {
  const [phase, setPhase] = useState('upload'); // upload | parsing | generating | done | error
  const [parseResult, setParseResult] = useState(null);
  const [imageState, setImageState] = useState({ total: 0, done: 0, images: [] });
  const [finalUrl, setFinalUrl] = useState(null);
  const [error, setError] = useState('');

  async function handleUpload(file) {
    setError('');
    setPhase('parsing');

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/bu-tu/parse', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setParseResult(data);

      if (data.tasks.length === 0) {
        setError('找不到可補圖的行（沒有 Prompt 核心關鍵字 + AI圖 為空的 row）');
        setPhase('error');
        return;
      }

      // 自動開始生圖
      await generateAll(data);
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  async function generateAll(parsed) {
    setPhase('generating');
    setImageState({ total: parsed.tasks.length, done: 0, images: [] });

    let cursor = 0;
    const results = [];

    async function worker() {
      while (true) {
        const idx = cursor++;
        if (idx >= parsed.tasks.length) return;
        const task = parsed.tasks[idx];
        try {
          const res = await fetch('/api/gen-image', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              prompt: task.prompt,
              referenceImages: task.refUrl ? [task.refUrl] : [],
              size: '1:1',
              brand: parsed.brand,
              themeName: task.sheetName,
            }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
          results[idx] = {
            sheetName: task.sheetName,
            rowNumber: task.rowNumber,
            aiColLetter: task.aiColLetter,
            url: d.url,
          };
          setImageState((s) => ({
            ...s,
            done: s.done + 1,
            images: [...s.images, { sheetName: task.sheetName, displayName: task.displayName, url: d.url }],
          }));
        } catch (e) {
          results[idx] = { error: e.message };
          setImageState((s) => ({
            ...s,
            done: s.done + 1,
            images: [...s.images, { sheetName: task.sheetName, displayName: task.displayName, error: e.message }],
          }));
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, parsed.tasks.length) }, worker));

    // finalize
    const validResults = results.filter((r) => r && !r.error);
    try {
      const res = await fetch('/api/bu-tu/finalize', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          xlsx_url: parsed.xlsx_url,
          brand: parsed.brand,
          results: validResults,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setFinalUrl(d.download_url);
      setPhase('done');
    } catch (e) {
      setError('補圖完成,但寫回 xlsx 失敗: ' + e.message);
      setPhase('error');
    }
  }

  function reset() {
    setPhase('upload');
    setParseResult(null);
    setImageState({ total: 0, done: 0, images: [] });
    setFinalUrl(null);
    setError('');
  }

  return (
    <main className="space-y-6">
      {phase === 'upload' && <UploadPanel onUpload={handleUpload} />}

      {(phase === 'parsing' || phase === 'generating' || phase === 'done' || phase === 'error') && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              {phase === 'parsing' && '📂 解析 xlsx 中…'}
              {phase === 'generating' && '🎨 補圖中'}
              {phase === 'done' && '🎉 補圖完成'}
              {phase === 'error' && '⚠️ 出錯'}
            </h2>
            {phase !== 'parsing' && (
              <button onClick={reset} className="text-sm text-stone-500 hover:text-stone-900">
                重新上傳
              </button>
            )}
          </div>

          {parseResult && (
            <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
              <div>品牌: <strong>{parseResult.brand || '(unknown)'}</strong></div>
              <div>掃描 {parseResult.sheets.length} 個 sheet,找到 <strong>{parseResult.tasks.length}</strong> 行可補圖</div>
              {parseResult.sheets.some((s) => s.already > 0) && (
                <div className="text-stone-500">
                  跳過 {parseResult.sheets.reduce((sum, s) => sum + s.already, 0)} 行（AI圖 已有值）
                </div>
              )}
            </div>
          )}

          {(phase === 'generating' || phase === 'done') && imageState.total > 0 && (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${(imageState.done / imageState.total) * 100}%` }}
                />
              </div>
              <p className="text-sm text-stone-600">
                {imageState.done}/{imageState.total}
                {phase === 'done' && ' ✓'}
                <span className="ml-3 text-xs text-stone-500">並行 {IMAGE_CONCURRENCY} 個</span>
              </p>

              {imageState.images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {imageState.images.map((img, i) => (
                    <div key={i} className="relative overflow-hidden rounded-lg border border-stone-200">
                      {img.error ? (
                        <div className="flex aspect-square items-center justify-center bg-red-50 p-2 text-center text-[10px] text-red-600">
                          ⚠ {img.error.slice(0, 30)}
                        </div>
                      ) : (
                        <a href={img.url} target="_blank" rel="noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.displayName} className="aspect-square w-full object-cover" loading="lazy" />
                        </a>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[10px] text-white">
                        {img.displayName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {phase === 'done' && finalUrl && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <p className="mb-3 text-sm text-green-800">
                ✓ AI 圖已寫回 xlsx,可下載最終版
              </p>
              <a
                href={finalUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="btn-primary bg-green-600 hover:bg-green-700"
              >
                ⬇ 下載含圖 xlsx
              </a>
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function UploadPanel({ onUpload }) {
  const [dragging, setDragging] = useState(false);

  function handleFiles(files) {
    const file = files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      alert('請上傳 .xlsx 檔案');
      return;
    }
    onUpload(file);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-semibold text-stone-900">🎨 補圖工坊</h1>
        <p className="mt-2 text-sm text-stone-600">
          上傳「文字生成」產出的 xlsx → 自動找出可補圖的行（有 Prompt 關鍵字 + 產品圖、AI圖 為空）→ 一鍵跑 KIE GPT Image 2 並行生圖 → 補回 xlsx
        </p>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-16 text-center transition ${
          dragging
            ? 'border-purple-500 bg-purple-50'
            : 'border-stone-300 bg-white hover:border-purple-300 hover:bg-purple-50/30'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <span className="text-5xl">📂</span>
        <span className="text-base font-medium text-stone-700">
          拖拉 xlsx 進來，或點擊選檔
        </span>
        <span className="text-xs text-stone-500">
          支援本站「文字生成」匯出的 xlsx；其他來源 xlsx 也可，但需有「Prompt 核心關鍵字」+「產品圖」欄位
        </span>
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      <p className="text-center text-xs text-stone-500">
        每張圖約 30–50 秒、並行 4 個。100 行約 5–7 分鐘、$4 USD 內。
      </p>
    </div>
  );
}
