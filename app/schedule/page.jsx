'use client';

// 排程:每週時刻表(依主題+類型彙整)+ 依主題篩選/分組管理,逐則編輯/刪除/立即發送(1 篇 1 篇)
import { useEffect, useMemo, useState } from 'react';

const WEEK = [
  { d: 1, label: '週一' }, { d: 2, label: '週二' }, { d: 3, label: '週三' },
  { d: 4, label: '週四' }, { d: 5, label: '週五' }, { d: 6, label: '週六' }, { d: 0, label: '週日' },
];
const TYPE_LABEL = { text: '純文字', long: '長文', image: '圖片' };
const hhmm = (ts) => { const x = new Date(ts); return `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
// 依主題類型/名稱給格子左側色條
function slotColor(type, name) {
  if ((name || '').match(/天氣|氣候/)) return 'border-l-blue-400';
  if (type === 'image') return 'border-l-gold-400';
  if (type === 'long') return 'border-l-brand-400';
  return 'border-l-sand-300';
}

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
  const [lightbox, setLightbox] = useState('');
  const [topics, setTopics] = useState([]);
  const [view, setView] = useState('month'); // 'month' | 'week'

  async function loadQueue() {
    setQBusy(true);
    try { const r = await fetch('/api/queue', { cache: 'no-store' }); const d = await r.json(); setQItems(d.items || []); }
    catch (e) { setError(e.message); } finally { setQBusy(false); }
  }
  useEffect(() => {
    loadQueue();
    (async () => { try { const r = await fetch('/api/settings', { cache: 'no-store' }); const d = await r.json(); setDailyAuto(!!d.dailyAuto); } catch (_) { setDailyAuto(false); } })();
    (async () => { try { const r = await fetch('/api/threads/post', { cache: 'no-store' }); const d = await r.json(); setConfigured(!!d.configured); } catch (_) { setConfigured(false); } })();
    (async () => { try { const r = await fetch('/api/topics', { cache: 'no-store' }); const d = await r.json(); setTopics(Array.isArray(d.topics) ? d.topics : []); } catch (_) {} })();
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

  // 每週排程:由各「主題」的 schedule 匯出成 時間列 × 星期欄 的格子(唯讀總覽)
  const wslots = useMemo(() => {
    const arr = [];
    for (const t of topics) for (const s of (t.schedule || [])) if (/^\d{2}:\d{2}$/.test(s.time || '')) arr.push({ time: s.time, weekday: s.weekday, topic: t });
    return arr;
  }, [topics]);
  const times = useMemo(() => [...new Set(wslots.map((s) => s.time))].sort(), [wslots]);
  const slotAt = useMemo(() => {
    const m = {};
    for (const s of wslots) { const k = `${s.time}|${s.weekday}`; (m[k] ||= []).push(s); }
    return m;
  }, [wslots]);
  const todayDow = new Date().getDay();

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

      {/* 排程總覽:月曆(實際佇列+未來預定連動) / 每週(主題時段) */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setView('month')} className={`rounded-full px-3 py-1.5 text-sm ${view === 'month' ? 'bg-brand-600 text-white shadow-soft' : 'text-sand-600 hover:bg-brand-50'}`}>📅 當月排程表</button>
            <button type="button" onClick={() => setView('week')} className={`rounded-full px-3 py-1.5 text-sm ${view === 'week' ? 'bg-brand-600 text-white shadow-soft' : 'text-sand-600 hover:bg-brand-50'}`}>🗓 每週總覽</button>
          </div>
          <a href="/post" className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-xs text-sand-600 hover:bg-brand-50">✏️ 到主題庫設定時段</a>
        </div>

        {view === 'month' && <MonthlyCalendar qItems={qItems} topics={topics} />}

        {view === 'week' && (<>
        <p className="text-[11px] text-sand-400">時段設定在各主題上(內容發文 → 建立主題 → 每個主題的「🗓 每週發文時段」)。這裡是唯讀總覽,cron 每天照此自動產文並排入下方佇列。</p>

        {wslots.length === 0 ? (
          <p className="text-xs text-sand-400">還沒有任何主題設定每週時段。到「內容發文 → 建立主題」,在主題卡的「🗓 每週發文時段」加時段並存檔。</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-sand-200">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-8 border-b border-sand-200 bg-sand-50 py-2 text-[11px] font-medium text-sand-500">
                <div className="px-3">時間</div>
                {WEEK.map(({ d, label }) => <div key={d} className={`px-2 ${d === todayDow ? 'font-semibold text-brand-700' : ''}`}>{label}{d === todayDow ? ' ·今天' : ''}</div>)}
              </div>
              {times.map((tm) => (
                <div key={tm} className="grid grid-cols-8 items-start border-b border-sand-100 py-2 last:border-0">
                  <div className="px-3 pt-1 text-xs font-medium text-sand-500">{tm}</div>
                  {WEEK.map(({ d }) => (
                    <div key={d} className={`px-1.5 ${d === todayDow ? 'bg-brand-50/40' : ''}`}>
                      {(slotAt[`${tm}|${d}`] || []).map((s, idx) => {
                        const tp = s.topic;
                        return (
                          <div key={idx} className={`mb-1 rounded-md border border-l-4 border-sand-200 bg-white px-2 py-1.5 shadow-soft ${slotColor(tp?.type, tp?.name)}`}>
                            <span className="text-[11px] font-medium leading-tight text-sand-800">{tp?.name || '—'}</span>
                            <span className="mt-0.5 block"><span className="inline-block rounded bg-sand-100 px-1 text-[9px] text-sand-500">{TYPE_LABEL[tp?.type] || '—'}</span></span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        </>)}
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
                              {it.imageUrl && <img src={it.imageUrl} alt="" onClick={() => setLightbox(it.imageUrl)} className="mt-1 w-32 cursor-zoom-in rounded-lg border border-sand-200 transition hover:opacity-90" />}
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

      {lightbox && (
        <div onClick={() => setLightbox('')} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-lift" />
          <button type="button" onClick={() => setLightbox('')} className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm text-sand-700">✕ 關閉</button>
        </div>
      )}
    </main>
  );
}

// 當月排程表:月曆呈現。連動「實際佇列項目(已排/已發)」＋「未來每週預定(主題 schedule 投影)」
function MonthlyCalendar({ qItems, topics }) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), todayD = now.getDate();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const startDow = new Date(y, m, 1).getDay(); // 0=日
  const WD = ['日', '一', '二', '三', '四', '五', '六'];

  // 實際佇列(本月)
  const byDate = {};
  for (const it of qItems) {
    const d = new Date(it.scheduledTs);
    if (d.getFullYear() === y && d.getMonth() === m) (byDate[d.getDate()] ||= []).push(it);
  }
  // 未來每週預定(主題 schedule 投影到本月各日,排除已有實際項目者)
  function plannedFor(day) {
    if (day < todayD) return [];
    const dow = new Date(y, m, day).getDay();
    const actual = byDate[day] || [];
    const res = [];
    for (const t of topics) {
      if (t.enabled === false) continue;
      for (const s of (t.schedule || [])) {
        if (s.weekday === dow && /^\d{2}:\d{2}$/.test(s.time || '')) {
          const dup = actual.some((a) => a.topicId === t.id && hhmm(a.scheduledTs) === s.time);
          if (!dup) res.push({ time: s.time, topic: t });
        }
      }
    }
    return res.sort((a, b) => a.time.localeCompare(b.time));
  }

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const statusChip = (it) => it.status === 'posted' ? 'border-l-emerald-400' : it.status === 'failed' ? 'border-l-red-400' : slotColor(it.type, it.topicName);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-sand-900">{y} 年 {m + 1} 月</h3>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-sand-500">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" />已發</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-gold-400" />待發</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm border border-dashed border-sand-400" />預定</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-sand-500">
            {WD.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="min-h-[86px] rounded-lg bg-sand-50/40" />;
              const actual = (byDate[day] || []).slice().sort((a, b) => a.scheduledTs - b.scheduledTs);
              const planned = plannedFor(day);
              const isToday = day === todayD;
              return (
                <div key={i} className={`min-h-[86px] rounded-lg border p-1 ${isToday ? 'border-brand-400 bg-brand-50/40' : 'border-sand-200 bg-white'}`}>
                  <div className={`mb-0.5 text-[11px] font-medium ${isToday ? 'text-brand-700' : 'text-sand-500'}`}>{day}</div>
                  <div className="space-y-0.5">
                    {actual.map((it) => (
                      <div key={it.id} className={`rounded border-l-2 bg-sand-50 px-1 py-0.5 text-[9px] leading-tight ${statusChip(it)}`} title={`${hhmm(it.scheduledTs)} ${it.topicName || ''}`}>
                        <span className="text-sand-700">{hhmm(it.scheduledTs)} {it.topicName || '—'}</span>
                        <span className="ml-0.5 text-sand-400">{TYPE_LABEL[it.type] || ''}</span>
                      </div>
                    ))}
                    {planned.map((p, j) => (
                      <div key={'p' + j} className={`rounded border-l-2 border-dashed bg-white px-1 py-0.5 text-[9px] leading-tight ${slotColor(p.topic?.type, p.topic?.name)}`} title={`${p.time} ${p.topic?.name || ''}(預定)`}>
                        <span className="text-sand-500">{p.time} {p.topic?.name || '—'}</span>
                        <span className="ml-0.5 text-sand-300">{TYPE_LABEL[p.topic?.type] || ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-sand-400">實心=實際佇列(已發/待發),虛線=未來每週預定(由主題時段投影,cron 到當天才會實際排入)。</p>
    </div>
  );
}
