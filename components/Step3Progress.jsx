'use client';

import { useEffect, useRef, useState } from 'react';

export default function Step3Progress({ input, themes, onDone, onBack }) {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [aborted, setAborted] = useState(false);
  const abortRef = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input, themes }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try {
              const ev = JSON.parse(t);
              setEvents((arr) => [...arr, ev]);
              if (ev.type === 'done') {
                onDone(ev);
                return;
              }
              if (ev.type === 'error') {
                throw new Error(ev.message);
              }
            } catch (e) {
              if (e.message.startsWith('Unexpected')) continue;
              throw e;
            }
          }
        }
      } catch (e) {
        if (e.name === 'AbortError') {
          setAborted(true);
        } else {
          setError(e.message);
        }
      }
    })();

    // 注意:這裡不能在 cleanup 裡 abort,否則 React Strict Mode 的雙跑會把第一次的 in-flight request 砍掉
    // 用戶要中止請按「取消」按鈕
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cancel() {
    abortRef.current?.abort();
  }

  // 算進度
  const themeStates = themes.map((t) => {
    const themeEvents = events.filter((e) => e.theme === t.name);
    const lastBatch = themeEvents.filter((e) => e.type === 'batch').slice(-1)[0];
    const doneEv = themeEvents.find((e) => e.type === 'theme_done');
    const failures = themeEvents.filter((e) => e.type === 'batch_failed');
    return {
      theme: t,
      done: !!doneEv,
      generated: doneEv ? doneEv.count : (lastBatch?.posts || 0),
      target: t.monthly_count || 30,
      currentBatch: lastBatch ? `${lastBatch.batch}/${lastBatch.batches}` : '-',
      failures: failures.length,
    };
  });

  const currentIndex = themeStates.findIndex((s) => !s.done);
  const totalGenerated = themeStates.reduce((s, x) => s + x.generated, 0);
  const totalTarget = themeStates.reduce((s, x) => s + x.target, 0);
  const recentSamples = events.filter((e) => e.type === 'sample').slice(-3);

  // 圖片進度
  const imageStartEv = events.find((e) => e.type === 'images_start');
  const imageProgressEvs = events.filter((e) => e.type === 'image_progress');
  const lastImageProgress = imageProgressEvs[imageProgressEvs.length - 1];
  const imagesDone = !!events.find((e) => e.type === 'images_done');
  const recentImages = events.filter((e) => e.type === 'image_uploaded').slice(-4);
  const imageWarnings = events.filter((e) => e.type === 'images_warning' || e.type === 'upload_warning');

  return (
    <div className="space-y-5">
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            生成中… {totalGenerated}/{totalTarget} 篇
          </h2>
          <button onClick={cancel} className="text-sm text-stone-500 hover:text-red-600">
            取消
          </button>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{
              width: `${totalTarget > 0 ? (totalGenerated / totalTarget) * 100 : 0}%`,
            }}
          />
        </div>

        <ul className="space-y-2">
          {themeStates.map((s, i) => (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                i === currentIndex ? 'bg-brand-50' : ''
              }`}
            >
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs ${
                  s.done
                    ? 'bg-brand-500 text-white'
                    : i === currentIndex
                    ? 'animate-pulse bg-stone-900 text-white'
                    : 'bg-stone-200 text-stone-500'
                }`}
              >
                {s.done ? '✓' : i + 1}
              </span>
              <span className="flex-1 text-sm font-medium text-stone-800">
                {s.theme.name}
              </span>
              <span className="text-xs text-stone-500">
                {s.generated}/{s.target}
                {s.failures > 0 && (
                  <span className="ml-2 text-red-600">⚠ {s.failures} 批失敗</span>
                )}
                {i === currentIndex && !s.done && (
                  <span className="ml-2 text-stone-400">batch {s.currentBatch}</span>
                )}
              </span>
            </li>
          ))}
        </ul>

        {imageStartEv && (
          <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-purple-900">
                🎨 圖片生成 (KIE GPT Image 2 → Cloudinary)
              </span>
              <span className="text-xs text-purple-700">
                {lastImageProgress?.done || 0} / {imageStartEv.total}
                {imagesDone && ' ✓'}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full bg-purple-500 transition-all"
                style={{
                  width: `${
                    imageStartEv.total > 0
                      ? ((lastImageProgress?.done || 0) / imageStartEv.total) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            {imageWarnings.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs text-amber-700">
                {imageWarnings.slice(-2).map((w, i) => (
                  <li key={i}>⚠ {w.message || w.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            ❌ {error}
            <button
              onClick={onBack}
              className="ml-3 underline"
            >
              返回主題編輯
            </button>
          </div>
        )}

        {aborted && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            已取消生成。
            <button onClick={onBack} className="ml-3 underline">
              返回主題編輯
            </button>
          </div>
        )}
      </div>

      {recentSamples.length > 0 && (
        <div className="card">
          <h3 className="mb-3 text-sm font-medium text-stone-600">最近產出樣本</h3>
          <div className="space-y-3">
            {recentSamples.map((s, i) => (
              <div key={i} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                  <span className="font-medium text-stone-700">{s.theme}</span>
                  <span>#{s.index}</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-stone-800">
                  {s.preview}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentImages.length > 0 && (
        <div className="card">
          <h3 className="mb-3 text-sm font-medium text-stone-600">最近產出圖片</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {recentImages.map((img, i) => (
              <a
                key={i}
                href={img.url}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-lg border border-stone-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={`${img.theme} #${img.index}`}
                  className="aspect-square w-full object-cover transition group-hover:scale-105"
                />
                <div className="border-t border-stone-200 bg-white px-2 py-1 text-[10px] text-stone-500">
                  {img.theme} #{img.index}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
