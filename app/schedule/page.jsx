'use client';

// 排程:每週時刻表(依主題+類型彙整)+ 依主題篩選/分組管理,逐則編輯/刪除/立即發送(1 篇 1 篇)
import { useEffect, useMemo, useState } from 'react';

const WEEK = [
  { d: 1, label: '週一' }, { d: 2, label: '週二' }, { d: 3, label: '週三' },
  { d: 4, label: '週四' }, { d: 5, label: '週五' }, { d: 6, label: '週六' }, { d: 0, label: '週日' },
];
const TYPE_LABEL = { text: '純文字', long: '長文', image: '圖片' };
const hhmm = (ts) => { const x = new Date(ts); return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };

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
  const [topicFilter, setTopicFilter] = useState('');
  const [collapsed, setCollapsed] = useState(new Set());   // 收合的主題
  const [editId, setEditId] = useState('');
  const [editText, setEditText] = useState('');
  const [sendingId, setSendingId] = useState('');

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
  async function removeQ(id) { if (!confirm('確定刪除這則?')) return; await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'remove', id }) }); loadQueue(); }
  async function clearPosted() { await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'clearPosted' }) }); loadQueue(); }
  function startEdit(it) { setEditId(it.id); setEditText(it.text); }
  async function saveEdit(id) {
    await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'update', id, patch: { text: editText } }) });
    setEditId(''); setEditText(''); loadQueue();
  }
  async function sendOne(it) {
    if (!confirm(`確定立即發送這則到 Threads?\n\n${it.text.slice(0, 60)}…`)) return;
    setSendingId(it.id); setQMsg('');
    try {
      const r = await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'postNow', id: it.id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setQMsg('✓ 已發送 1 則'); loadQueue();
    } catch (e) { setError('發送失敗:' + e.message); } finally { setSendingId(''); }
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

  const pending = useMemo(() => qItems.filter((x) => x.status === 'pending').sort((a, b) => a.scheduledTs - b.scheduledTs), [qItems]);

  // 每週時刻表:依 星期 → (時間+主題+類型) 彙整,不列每篇日期
  const weekly = useMemo(() => {
    const wk = {};
    for (const it of pending) {
      const wd = new Date(it.scheduledTs).getDay();
      const key = `${hhmm(it.scheduledTs)}|${it.topicName || '(未指定)'}|${it.type || ''}`;
      (wk[wd] ||= {});
      const g = (wk[wd][key] ||= { time: hhmm(it.scheduledTs), topicName: it.topicName || '(未指定)', type: it.type || '', count: 0 });
      g.count += 1;
    }
    return wk;
  }, [pending]);

  // 佇列依主題分組(可篩選)
  const topicsInQueue = useMemo(() => [...new Set(qItems.map((x) => x.topicName || '(未指定)'))], [qItems]);
  const groups = useMemo(() => {
    const src = topicFilter ? qItems.filter((x) => (x.topicName || '(未指定)') === topicFilter) : qItems;
    const g = {};
    for (const it of src) { const k = it.topicName || '(未指定)'; (g[k] ||= []).push(it); }
    for (const k in g) g[k].sort((a, b) => a.scheduledTs - b.scheduledTs);
    return g;
  }, [qItems, topicFilter]);

  function toggleCollapse(k) { setCollapsed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; }); }

  return (
    <main className="space-y-6">
      <div className="card border-brand-200 bg-brand-50/40">
        <h1 className="font-display text-2xl font-semibold text-sand-900">🗓 排程</h1>
        <p className="mt-2 text-sm text-sand-600">看每週要發哪些主題、管理待發佇列(可依主題篩選、逐則編輯/刪除/立即發送)。到期貼文由外部 cron 每小時自動發;你也可以在這裡一篇一篇手動發。</p>
        <p className="mt-2 text-xs">{configured === null ? '　' : configured ? <span className="text-emerald-600">✓ Threads 已連接</span> : <span className="text-gold-600">⚠ Threads 未連接 — 到「連線設定」設定後才能發文</span>}</p>
      </div>

      {/* 每週時刻表(依主題+類型) */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-sand-800">每週時刻表 <span className="font-normal text-sand-500">(待發 {pending.length} 則)</span></h2>
          <button type="button" onClick={loadQueue} disabled={qBusy} className="rounded-xl border border-sand-200 bg-white px-2 py-1 text-xs text-sand-500 hover:bg-brand-50">↻ 重整</button>
        </div>
        {pending.length === 0 ? (
          <p className="text-xs text-sand-400">目前沒有待發的排程。到「內容發文 → 主題產文」勾選後按「送到排程」。</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {WEEK.map(({ d, label }) => {
              const gs = Object.values(weekly[d] || {}).sort((a, b) => a.time.localeCompare(b.time));
              return (
                <div key={d} className={`rounded-2xl border p-3 ${gs.length ? 'border-brand-200 bg-brand-50/30' : 'border-sand-200 bg-sand-50/50'}`}>
                  <div className="mb-2 font-display text-sm font-semibold text-sand-800">{label}</div>
                  <div className="space-y-1.5">
                    {gs.length === 0 ? <span className="text-[11px] text-sand-400">—</span> : gs.map((g, i) => (
                      <div key={i} className="rounded-xl bg-white px-2.5 py-1.5 text-xs shadow-soft">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-brand-700">{g.time}</span>
                          <span className="rounded-full bg-gold-100 px-1.5 text-[10px] text-gold-700">{TYPE_LABEL[g.type] || g.type || '—'}</span>
                          {g.count > 1 && <span className="text-[10px] text-sand-400">×{g.count}</span>}
                        </div>
                        <div className="truncate text-sand-700">{g.topicName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 佇列管理:依主題篩選 + 分組 + 逐則操作 */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-sand-800">待發佇列 <span className="font-normal text-sand-500">({qItems.length})</span></h2>
          <div className="flex flex-wrap items-center gap-2">
            {qMsg && <span className="text-xs text-emerald-700">{qMsg}</span>}
            <select className="input w-auto py-1.5 text-xs" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
              <option value="">全部主題</option>
              {topicsInQueue.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" onClick={reviewPrices} className="btn-gold text-xs">🔄 更新未發價格</button>
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

        {Object.keys(groups).length === 0 ? <p className="text-xs text-sand-400">佇列是空的。</p> : (
          <div className="space-y-2">
            {Object.entries(groups).map(([topic, list]) => {
              const isCollapsed = collapsed.has(topic);
              const pend = list.filter((x) => x.status === 'pending').length;
              const type = list[0]?.type;
              return (
                <div key={topic} className="rounded-2xl border border-sand-200">
                  <button type="button" onClick={() => toggleCollapse(topic)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-sand-50">
                    <span className="flex items-center gap-2 text-sm font-medium text-sand-800">
                      <span className="text-sand-400">{isCollapsed ? '▸' : '▾'}</span>
                      {topic}
                      <span className="rounded-full bg-gold-100 px-1.5 text-[10px] text-gold-700">{TYPE_LABEL[type] || type || '—'}</span>
                    </span>
                    <span className="text-xs text-sand-500">{list.length} 則{pend ? ` · 待發 ${pend}` : ''}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="space-y-1.5 border-t border-sand-100 p-2">
                      {list.map((it) => (
                        <div key={it.id} className="rounded-xl border border-sand-200 p-2 text-xs">
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`shrink-0 rounded-full px-2 py-0.5 ${it.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : it.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gold-100 text-gold-700'}`}>{it.status === 'posted' ? '已發' : it.status === 'failed' ? '失敗' : '待發'}</span>
                            <span className="text-sand-500">{new Date(it.scheduledTs).toLocaleString('zh-TW')}</span>
                            {it.status === 'posted' && it.permalink && <a href={it.permalink} target="_blank" rel="noreferrer" className="text-brand-600 underline">看貼文↗</a>}
                          </div>
                          {editId === it.id ? (
                            <>
                              <textarea className="input min-h-[80px] text-sm" value={editText} onChange={(e) => setEditText(e.target.value)} />
                              <div className="mt-1 flex gap-2">
                                <button type="button" onClick={() => saveEdit(it.id)} className="rounded-lg bg-brand-600 px-2.5 py-1 font-medium text-white hover:bg-brand-700">儲存</button>
                                <button type="button" onClick={() => setEditId('')} className="rounded-lg border border-sand-200 px-2.5 py-1 text-sand-500">取消</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="whitespace-pre-wrap text-sand-800">{it.text}</div>
                              {it.status === 'failed' && <div className="mt-1 text-red-600">{it.error}</div>}
                              {it.status !== 'posted' && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <button type="button" onClick={() => sendOne(it)} disabled={sendingId === it.id} className="rounded-lg bg-emerald-600 px-2.5 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">{sendingId === it.id ? '發送中…' : '🧵 立即發送'}</button>
                                  <button type="button" onClick={() => startEdit(it)} className="rounded-lg border border-sand-200 px-2.5 py-1 text-sand-600 hover:bg-sand-50">✏️ 編輯</button>
                                  <button type="button" onClick={() => removeQ(it.id)} className="rounded-lg border border-sand-200 px-2.5 py-1 text-red-600 hover:bg-red-50">🗑 刪除</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">❌ {error}</div>}
    </main>
  );
}
