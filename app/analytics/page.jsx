'use client';

// 成效分析:選期間(預設近 30 天)→ 依型態/主題彙整 + 過去期間最佳 10 篇
import { useEffect, useState } from 'react';

const dstr = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const DAY = 86400000;

export default function AnalyticsPage() {
  const now = Date.now();
  const [from, setFrom] = useState(dstr(now - 30 * DAY));
  const [to, setTo] = useState(dstr(now));
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function load(fromStr = from, toStr = to) {
    setBusy(true); setError('');
    try {
      const fromMs = new Date(`${fromStr}T00:00:00`).getTime();
      const toMs = new Date(`${toStr}T23:59:59`).getTime();
      const r = await fetch(`/api/analytics?from=${fromMs}&to=${toMs}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.error) setError(d.error);
      setData(d);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);

  function quick(days) {
    const f = dstr(Date.now() - days * DAY), t = dstr(Date.now());
    setFrom(f); setTo(t); load(f, t);
  }

  const hasInsights = data?.hasInsights;
  const t = data?.totals;

  const METRIC_COLS = [
    ['views', '瀏覽'], ['engagement', '互動'], ['rate', '互動率%'],
    ['likes', '愛心'], ['replies', '留言'], ['reposts', '轉發'], ['quotes', '引用/分享'],
  ];

  return (
    <main className="space-y-6">
      <div className="card border-brand-200 bg-brand-50/50">
        <h1 className="font-display text-2xl font-semibold text-sand-900">📊 成效分析</h1>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <button type="button" onClick={() => quick(7)} className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-sm text-sand-600 shadow-soft hover:bg-sand-50">近 7 天</button>
          <button type="button" onClick={() => quick(30)} className="rounded-lg border border-sand-300 bg-white px-3 py-1.5 text-sm text-sand-600 shadow-soft hover:bg-sand-50">近 30 天</button>
          <div><label className="label text-xs">起</label><input type="date" className="input text-sm" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><label className="label text-xs">迄</label><input type="date" className="input text-sm" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <button type="button" onClick={() => load()} disabled={busy} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white shadow-soft hover:bg-brand-700 disabled:opacity-50">{busy ? '讀取中…' : '查詢'}</button>
        </div>
        {data && !hasInsights && <p className="mt-2 text-xs text-gold-600">未連 Threads insights → 僅顯示發文數。設定 THREADS_ACCESS_TOKEN 並開 threads_manage_insights 權限後即可看瀏覽/互動。（收藏數 Threads API 未提供）</p>}
      </div>

      {/* 總覽 */}
      {t && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['發文數', t.count], ['總瀏覽', hasInsights ? t.views.toLocaleString() : '—'], ['總互動', hasInsights ? t.engagement.toLocaleString() : '—'], ['互動率', hasInsights ? t.rate + '%' : '—']].map(([k, v]) => (
            <div key={k} className="card text-center"><div className="text-xs text-sand-500">{k}</div><div className="mt-1 font-display text-2xl font-semibold text-sand-900">{v}</div></div>
          ))}
        </div>
      )}

      {/* 依型態 */}
      <Section title="依型態(圖文 / 長文 / 純文字)">
        <MetricTable rows={(data?.byType || []).map((r) => ({ label: r.typeLabel, ...r }))} nameHead="型態" cols={METRIC_COLS} hasInsights={hasInsights} />
      </Section>

      {/* 依主題 */}
      <Section title="依主題" action={<span className="text-[11px] text-sand-400">排序:{hasInsights ? '瀏覽數' : '發文數'}</span>}>
        <MetricTable rows={(data?.byTopic || []).map((r) => ({ label: r.topicName, ...r }))} nameHead="主題" cols={METRIC_COLS} hasInsights={hasInsights}
          extra={(r) => <a href="/post" className="text-brand-600 underline">用此主題產文</a>} />
      </Section>

      {/* Top 10 */}
      <Section title="期間最佳 10 篇貼文">
        {(!data?.topPosts || data.topPosts.length === 0)
          ? <p className="text-sm text-sand-400">{hasInsights ? '此期間尚無有數據的貼文。' : '需連 Threads insights 才能排名。'}</p>
          : (
            <div className="space-y-1.5">
              {data.topPosts.map((p, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border border-sand-200 p-2 text-xs hover:bg-sand-50">
                  <span className="mt-0.5 w-5 shrink-0 text-center font-semibold text-brand-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sand-800">{p.textPreview || '(無預覽)'}</div>
                    <div className="text-sand-500">{p.topicName} · {({ text: '純文字', long: '長文', image: '圖片' })[p.type] || p.type} · {new Date(p.ts).toLocaleDateString('zh-TW')}{p.permalink && <> · <a href={p.permalink} target="_blank" rel="noreferrer" className="text-brand-600 underline">看貼文↗</a></>}</div>
                  </div>
                  <div className="shrink-0 text-right text-sand-600">👁{p.views.toLocaleString()}<br />❤{p.likes} 🔁{p.reposts} 💬{p.replies}</div>
                </div>
              ))}
            </div>
          )}
      </Section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">⚠ {error}</div>}
    </main>
  );
}

function Section({ title, action, children }) {
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between"><h2 className="font-display text-sm font-semibold text-sand-800">{title}</h2>{action}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function MetricTable({ rows, nameHead, cols, hasInsights, extra }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-sand-400">此期間尚無資料。</p>;
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead>
        <tr className="border-b border-sand-200 bg-sand-50 text-left text-xs text-sand-600">
          <th className="py-2 pr-3">{nameHead}</th>
          <th className="px-2 text-right">發文數</th>
          {hasInsights && cols.map(([k, l]) => <th key={k} className="px-2 text-right">{l}</th>)}
          {extra && <th className="px-2"></th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-sand-100 hover:bg-sand-50">
            <td className="py-2 pr-3 font-medium text-sand-800">{r.label}</td>
            <td className="px-2 text-right">{r.count}</td>
            {hasInsights && cols.map(([k]) => <td key={k} className="px-2 text-right">{k === 'rate' ? r.rate + '%' : (r[k] ?? 0).toLocaleString()}</td>)}
            {extra && <td className="px-2 text-right">{extra(r)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
