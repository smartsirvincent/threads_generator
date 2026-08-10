'use client';

// 成效分析:依主題彙整發文數據(發文數 + Threads insights)
import { useEffect, useState } from 'react';

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/analytics', { cache: 'no-store' });
      const d = await r.json();
      if (d.error) setError(d.error);
      setData(d);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);

  const rows = data?.byTopic || [];
  const hasInsights = data?.hasInsights;

  return (
    <main className="space-y-6">
      <div className="card border-indigo-200 bg-indigo-50/40">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-stone-900">📊 成效分析</h1>
          <button type="button" onClick={load} disabled={busy} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-50">
            {busy ? '讀取中…' : '↻ 重新整理'}
          </button>
        </div>
        <p className="mt-2 text-sm text-stone-600">
          依「主題」彙整透過本站發到 Threads 的貼文。{data ? `共 ${data.totalPosts} 篇。` : ''}
          {data && !hasInsights && <span className="text-amber-600">（未連 Threads insights,先顯示發文數;設定 THREADS_ACCESS_TOKEN 並開啟 insights 權限後可看觀看/互動）</span>}
        </p>
      </div>

      <div className="card overflow-x-auto">
        {busy ? <p className="text-sm text-stone-500">讀取中…</p>
          : rows.length === 0 ? <p className="text-sm text-stone-400">還沒有發文紀錄。到「🧵 內容/發文」用主題發文後,這裡就會依主題統計。</p>
          : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                  <th className="py-2 pr-3">主題</th>
                  <th className="px-2">型別</th>
                  <th className="px-2 text-right">發文數</th>
                  {hasInsights && <><th className="px-2 text-right">觀看</th><th className="px-2 text-right">互動</th><th className="px-2 text-right">平均觀看</th></>}
                  <th className="px-2">最近發文</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="py-2 pr-3 font-medium text-stone-800">{r.topicName}</td>
                    <td className="px-2 text-stone-500">{r.typeLabel || '—'}</td>
                    <td className="px-2 text-right">{r.count}</td>
                    {hasInsights && <>
                      <td className="px-2 text-right">{r.views.toLocaleString()}</td>
                      <td className="px-2 text-right">{r.engagement.toLocaleString()}</td>
                      <td className="px-2 text-right">{r.measured ? Math.round(r.views / r.measured).toLocaleString() : '—'}</td>
                    </>}
                    <td className="px-2 text-stone-500">{r.lastTs ? new Date(r.lastTs).toLocaleDateString('zh-TW') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">⚠ {error}</div>}
    </main>
  );
}
