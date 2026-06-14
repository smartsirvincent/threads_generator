'use client';

import { useState } from 'react';

export default function MaterialPage() {
  const [phase, setPhase] = useState('upload'); // upload | generating | done | error
  const [refPreview, setRefPreview] = useState(null);
  const [refUrl, setRefUrl] = useState(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  async function handleFile(file) {
    if (!file) return;
    if (!/image\/(png|jpe?g|webp|gif)/.test(file.type)) {
      setError('請上傳 PNG / JPG / WEBP 圖片');
      return;
    }
    setError('');

    // 本機預覽
    const reader = new FileReader();
    reader.onload = () => setRefPreview(reader.result);
    reader.readAsDataURL(file);

    // 上傳到雲端拿 URL
    setPhase('generating');
    try {
      const form = new FormData();
      form.append('file', file);
      const upRes = await fetch('/api/material/upload-ref', { method: 'POST', body: form });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || `上傳失敗 HTTP ${upRes.status}`);
      setRefUrl(upData.url);

      // 觸發 3 並行生成
      const genRes = await fetch('/api/material/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refUrl: upData.url, extraPrompt }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error || `生成失敗 HTTP ${genRes.status}`);
      setResults(genData.results || []);
      setPhase('done');
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  }

  function reset() {
    setPhase('upload');
    setRefPreview(null);
    setRefUrl(null);
    setResults([]);
    setError('');
  }

  return (
    <main className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-semibold text-stone-900">✨ 素材產生器</h1>
        <p className="mt-2 text-sm text-stone-600">
          上傳 1 張參考圖 → AI 模仿視覺風格 → 同時輸出 <strong>1:1 / 9:16 / 1.91:1</strong> 三種比例。
          適用 IG 動態 / Reels / Stories / FB 廣告。
        </p>
        <p className="mt-1 text-xs text-stone-500">
          ⏱ 預估 ~1.5 分鐘 · 💰 ~$0.12 USD
        </p>
      </div>

      {phase === 'upload' && (
        <>
          <div className="card">
            <label className="label">
              額外指示（選填）
              <span className="ml-1 font-normal text-stone-500">— 例：「加上一些柔光」「換成黃昏色調」「移除人物」</span>
            </label>
            <textarea
              className="input min-h-[70px] text-sm"
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="留空就純模仿風格;有特殊要求可寫"
            />
          </div>

          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-stone-300 bg-white py-16 text-center transition hover:border-emerald-300 hover:bg-emerald-50/30"
          >
            <span className="text-5xl">🖼️</span>
            <span className="text-base font-medium text-stone-700">
              點擊或拖拉參考圖到這裡
            </span>
            <span className="text-xs text-stone-500">
              支援 PNG / JPG / WEBP · 系統會自動模仿其風格
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </>
      )}

      {phase === 'generating' && (
        <div className="card space-y-4 text-center">
          {refPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={refPreview} alt="reference" className="mx-auto max-h-64 rounded-lg" />
          )}
          <p className="text-stone-700">🎨 AI 模仿風格中，三種比例並行生成…</p>
          <p className="text-xs text-stone-500">通常 60–90 秒，請稍候</p>
        </div>
      )}

      {phase === 'done' && (
        <>
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">🎉 三種比例已產出</h2>
              <button onClick={reset} className="text-sm text-stone-500 hover:text-stone-900">
                重新上傳
              </button>
            </div>
            {refPreview && (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-stone-50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={refPreview} alt="ref" className="size-16 rounded-md object-cover" />
                <span className="text-xs text-stone-500">原始參考圖</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {results.map((r, i) => (
              <ResultCard key={i} result={r} />
            ))}
          </div>
        </>
      )}

      {phase === 'error' && (
        <div className="card border-red-200 bg-red-50">
          <p className="text-sm text-red-700">❌ {error}</p>
          <button onClick={reset} className="mt-3 btn-secondary text-xs">
            重試
          </button>
        </div>
      )}
    </main>
  );
}

const RATIO_INFO = {
  '1:1': { label: 'IG 動態 / FB 貼文', hint: '正方形' },
  '9:16': { label: 'Reels / Stories', hint: '直式 9:16' },
  '1.91:1': { label: 'FB 廣告 / IG 橫向', hint: '橫式 1.91:1' },
};

function ResultCard({ result }) {
  const info = RATIO_INFO[result.target] || {};
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="bg-stone-50 px-3 py-2">
        <div className="text-sm font-semibold text-stone-800">{result.target}</div>
        <div className="text-[11px] text-stone-500">{info.label} · {info.hint}</div>
      </div>
      <div
        className="relative bg-stone-100"
        style={{
          aspectRatio: result.target === '1:1' ? '1/1' : result.target === '9:16' ? '9/16' : '1.91/1',
        }}
      >
        {result.error ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-red-600">
            ⚠ {result.error.slice(0, 80)}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.url}
            alt={result.target}
            className="size-full object-cover"
            loading="lazy"
          />
        )}
      </div>
      {!result.error && (
        <div className="border-t border-stone-200 bg-white p-2">
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            download
            className="block rounded-md bg-emerald-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-emerald-700"
          >
            ⬇ 下載
          </a>
        </div>
      )}
    </div>
  );
}
