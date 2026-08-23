'use client';

// 排程:獨立區塊。看排程現況(每週幾幾點發哪個主題的時刻表)+ 佇列管理 + 每日自動產文 + 更新未發價格
import { useEffect, useState } from 'react';

const WEEK = [
  { d: 1, label: '週一' }, { d: 2, label: '週二' }, { d: 3, label: '週三' },
  { d: 4, label: '週四' }, { d: 5, label: '週五' }, { d: 6, label: '週六' }, { d: 0, label: '週日' },
];
const hhmm = (ts) => { const x = new Date(ts); return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
const mmdd = (ts) => { const x = new Date(ts); return `${x.getMonth() + 1}/${x.getDate()}`; };

export default function SchedulePage() {
  const [qItems, setQItems] = useState([]);
  const [qBusy, setQBusy] = useState(false);
  const [qMsg, setQMsg] = useState('');
  const [error, setError] = useState('');
  const [priceReview, setPriceReview] = useState(null);
  const [pricePick, setPricePick] = useState(new Set());
  const [priceMsg, setPriceMsg] = useState('');
  const [dailyAuto, setDailyAuto] = useState(null);
  const [configured, setConfigured] = useState(null);

  async function loadQueue() {
    setQBusy(true);
    try { const r = await fetch('/api/queue', { cache: 'no-store' }); const d = await r.json(); setQItems(d.items || []); }
    catch (e) { setError(e.message); } finally { setQBusy(false); }
  }
  useEffect(() => {
    loadQueue();
    (async () => { try { const r = await fetch('/api/settings', { cache: 'no-store' }); const d = await r.json(); setDailyAuto(!!d.dailyAuto); } catch (_) { setDailyAuto(false); } })();
    (async () => { try { const r = await fetch('/api/threads/post', { cache: 'no-store' }); const d = await r.json(); setConfigured(!!d.configured); } catch (_) { setConfigured(false); } })();
  }, []);

  async function toggleDailyAuto(v) {
    setDailyAuto(v);
    try { await fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dailyAuto: v }) }); }
    catch (_) { setDailyAuto(!v); }
  }
  async function removeQ(id) { await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id }) }); loadQueue(); }
  async function clearPosted() { await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'clearPosted' }) }); loadQueue(); }
  async function runDue() {
    setQMsg('檢查發送中…');
    try { const r = await fetch('/api/cron/post-due', { method: 'POST' }); const d = await r.json(); setQMsg(d.error ? '⚠ ' + d.error : `✓ 發了 ${d.posted || 0} 則,待發 ${d.remaining ?? '?'}`); loadQueue(); }
    catch (e) { setQMsg('⚠ ' + e.message); }
  }
  async function reviewPrices() {
    setPriceMsg('比對中…'); setPriceReview(null);
    try {
      const r = await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'refreshPreview' }) });
      const d = await r.json();
      setPriceReview(d.items || []);
      setPricePick(new Set((d.items || []).map((x) => x.id)));
      setPriceMsg(d.items?.length ? `找到 ${d.items.length} 則待發貼文含舊價,可更新` : (d.changesCount ? '沒有待發貼文需要更新' : '目前沒有價格異動紀錄(改價存檔後才會有)'));
    } catch (e) { setPriceMsg('⚠ ' + e.message); }
  }
  async function applyPrices() {
    const ids = [...pricePick];
    if (!ids.length) { setPriceMsg('沒有勾選'); return; }
    setPriceMsg('更新中…');
    try {
      const r = await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'applyPrices', ids }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      setPriceMsg(`✓ 已更新 ${d.updated} 則的價格`); setPriceReview(null); loadQueue();
    } catch (e) { setPriceMsg('⚠ ' + e.message); }
  }

  const pending = qItems.filter((x) => x.status === 'pending').sort((a, b) => a.scheduledTs - b.scheduledTs);
  const byWeekday = {};
  for (const it of pending) { const wd = new Date(it.scheduledTs).getDay(); (byWeekday[wd] ||= []).push(it); }

  return (
    <main className="space-y-6">
      <div className="card border-brand-200 bg-brand-50/40">
        <h1 className="font-display text-2xl font-semibold text-sand-900">🗓 排程</h1>
        <p className="mt-2 text-sm text-sand-600">看排程現況(每週幾、幾點、發哪個主題)、管理待發佇列、每日自動產文。到期貼文由外部 cron 每小時打 <code>/api/cron/tick</code> 自動發。</p>
        <p className="mt-2 text-xs">{configured === null ? '　' : configured ? <span className="text-emerald-600">✓ Threads 已連接</span> : <span className="text-gold-600">⚠ Threads 未連接 — 到「連線設定」設定後才能自動發文</span>}</p>
      </div>

      {/* 每週時刻表 */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-sand-800">每週時刻表 <span className="font-normal text-sand-500">(待發 {pending.length} 則)</span></h2>
          <button type="button" onClick={loadQueue} disabled={qBusy} className="rounded-xl border border-sand-200 bg-white px-2 py-1 text-xs text-sand-500 hover:bg-brand-50">↻ 重整</button>
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-sand-400">目前沒有待發的排程。到「內容發文 → 批次產文」勾選後按「送到排程」。</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {WEEK.map(({ d, label }) => {
              const items = (byWeekday[d] || []);
              return (
                <div key={d} className={`rounded-2xl border p-3 ${items.length ? 'border-brand-200 bg-brand-50/30' : 'border-sand-200 bg-sand-50/50'}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-display text-sm font-semibold text-sand-800">{label}</span>
                    <span className="text-[11px] text-sand-400">{items.length ? `${items.length} 則` : '—'}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((it) => (
                      <div key={it.id} className="rounded-xl bg-white px-2.5 py-1.5 text-xs shadow-soft">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-brand-700">{hhmm(it.scheduledTs)}</span>
                          <span className="text-sand-400">{mmdd(it.scheduledTs)}</span>
                        </div>
                        <div className="truncate text-sand-700">{it.topicName || '(未指定主題)'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 佇列管理 */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-sand-800">待發佇列 <span className="font-normal text-sand-500">({qItems.length})</span></h2>
          <div className="flex flex-wrap items-center gap-2">
            {qMsg && <span className="text-xs text-emerald-700">{qMsg}</span>}
            <button type="button" onClick={reviewPrices} className="btn-gold text-xs">🔄 更新未發價格</button>
            <button type="button" onClick={runDue} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">▶ 立即檢查發送</button>
            <button type="button" onClick={clearPosted} className="btn-secondary text-xs">🧹 清除已發</button>
          </div>
        </div>

        <label className="flex items-center gap-2 rounded-2xl border border-brand-200 bg-brand-50/50 px-3 py-2 text-sm text-sand-700">
          <input type="checkbox" checked={!!dailyAuto} disabled={dailyAuto === null} onChange={(e) => toggleDailyAuto(e.target.checked)} className="size-4 rounded border-sand-300 text-brand-600 focus:ring-brand-500" />
          🤖 每日自動產 1 篇（依近期成效最佳的主題自動產文並排入佇列）
          <span className="text-[11px] text-sand-400">{dailyAuto === null ? '' : dailyAuto ? '已開啟' : '關閉'}</span>
        </label>

        {priceReview !== null && (
          <div className="rounded-2xl border border-gold-200 bg-gold-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gold-700">待更新價格的貼文 ({priceReview.length})</span>
              {priceMsg && <span className="text-xs text-gold-700">{priceMsg}</span>}
            </div>
            {priceReview.length > 0 && (
              <>
                {priceReview.map((p) => (
                  <label key={p.id} className="flex items-start gap-2 rounded-xl border border-gold-200 bg-white p-2 text-xs">
                    <input type="checkbox" checked={pricePick.has(p.id)} onChange={(e) => setPricePick((s) => { const n = new Set(s); e.target.checked ? n.add(p.id) : n.delete(p.id); return n; })} className="mt-0.5 size-4 rounded border-sand-300 text-gold-600" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sand-500">{p.topicName || '—'} · {new Date(p.scheduledTs).toLocaleString('zh-TW')}</div>
                      {(p.applied || []).map((c, i) => <div key={i} className="text-gold-700">價格:<span className="line-through">{c.from}</span> → <strong>{c.to}</strong></div>)}
                    </div>
                  </label>
                ))}
                <button type="button" onClick={applyPrices} className="btn-gold text-xs">套用所選 ({pricePick.size})</button>
              </>
            )}
          </div>
        )}

        {qItems.length === 0 ? <p className="text-xs text-sand-400">佇列是空的。</p> : (
          <div className="space-y-1.5">
            {qItems.slice().sort((a, b) => a.scheduledTs - b.scheduledTs).map((it) => (
              <div key={it.id} className="flex items-start gap-2 rounded-2xl border border-sand-200 p-3 text-xs">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 ${it.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : it.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gold-100 text-gold-700'}`}>{it.status === 'posted' ? '已發' : it.status === 'failed' ? '失敗' : '待發'}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sand-500">{new Date(it.scheduledTs).toLocaleString('zh-TW')} · {it.topicName || '—'}</div>
                  <div className="truncate text-sand-800">{it.text}</div>
                  {it.status === 'posted' && it.permalink && <a href={it.permalink} target="_blank" rel="noreferrer" className="text-brand-600 underline">看貼文 ↗</a>}
                  {it.status === 'failed' && <span className="text-red-600">{it.error}</span>}
                </div>
                <button type="button" onClick={() => removeQ(it.id)} className="shrink-0 rounded-lg px-1.5 py-0.5 text-red-600 hover:bg-red-50">🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">❌ {error}</div>}
    </main>
  );
}
