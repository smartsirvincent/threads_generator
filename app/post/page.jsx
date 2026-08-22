'use client';

// 內容流程:主題庫(3型別+提示詞+存檔) → 依主題批次產文(≤100)→ 勾選送排程/立即發 → 排程自動發到 Threads
import { useEffect, useState } from 'react';
import { medicalClinicProfile, CANONICAL_PROFILE_NAME } from '@/lib/verticals.js';
import { loadCanonicalProfile } from '@/lib/profile-store.js';

const DEFAULT_PROFILE = medicalClinicProfile();
const TYPES = [
  { key: 'text', label: '純文字', emoji: '📝' },
  { key: 'long', label: '長文', emoji: '📄' },
  { key: 'image', label: '圖片', emoji: '🖼' },
];
const typeMeta = (k) => TYPES.find((t) => t.key === k) || TYPES[0];
const newId = () => `t-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export default function PostPage() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const ctx = { brand: profile.brand, brand_persona: profile.brand_persona, audience: profile.audience };
  const clinic = profile.clinic || null;

  const [tab, setTab] = useState('library');
  const [topics, setTopics] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [threadsConfigured, setThreadsConfigured] = useState(null);
  const [error, setError] = useState('');

  // brainstorm
  const [bsType, setBsType] = useState('text');
  const [bsKeyword, setBsKeyword] = useState('');
  const [bsCount, setBsCount] = useState(4);
  const [suggestions, setSuggestions] = useState([]);
  const [bsBusy, setBsBusy] = useState(false);

  // produce
  const [selId, setSelId] = useState('');
  const [count, setCount] = useState(5);
  const [gens, setGens] = useState([]); // [{id,text,keep}]
  const [genBusy, setGenBusy] = useState(false);
  const [genProg, setGenProg] = useState({ done: 0, total: 0 });
  const [startDate, setStartDate] = useState(todayStr());
  const [times, setTimes] = useState('12:00,20:00');
  const [actMsg, setActMsg] = useState('');

  // queue
  const [qItems, setQItems] = useState([]);
  const [qBusy, setQBusy] = useState(false);
  const [qMsg, setQMsg] = useState('');
  // 更新未發價格
  const [priceReview, setPriceReview] = useState(null); // null=未查; []=無需更新
  const [pricePick, setPricePick] = useState(new Set());
  const [priceMsg, setPriceMsg] = useState('');
  // 每日自動產文
  const [dailyAuto, setDailyAuto] = useState(null);

  useEffect(() => {
    (async () => { const canon = await loadCanonicalProfile(CANONICAL_PROFILE_NAME); if (canon?.products?.length) setProfile({ ...DEFAULT_PROFILE, ...canon }); })();
    (async () => { try { const r = await fetch('/api/topics', { cache: 'no-store' }); const d = await r.json(); setTopics(Array.isArray(d.topics) ? d.topics : []); } catch (_) {} })();
    (async () => { try { const r = await fetch('/api/threads/post', { cache: 'no-store' }); const d = await r.json(); setThreadsConfigured(!!d.configured); } catch (_) { setThreadsConfigured(false); } })();
    (async () => { try { const r = await fetch('/api/settings', { cache: 'no-store' }); const d = await r.json(); setDailyAuto(!!d.dailyAuto); } catch (_) { setDailyAuto(false); } })();
  }, []);

  async function toggleDailyAuto(v) {
    setDailyAuto(v);
    try { await fetch('/api/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dailyAuto: v }) }); }
    catch (_) { setDailyAuto(!v); }
  }

  async function loadQueue() {
    setQBusy(true);
    try { const r = await fetch('/api/queue', { cache: 'no-store' }); const d = await r.json(); setQItems(d.items || []); }
    catch (e) { setError(e.message); } finally { setQBusy(false); }
  }
  useEffect(() => { if (tab === 'queue') loadQueue(); }, [tab]);

  // ---- 主題庫 ----
  async function brainstorm() {
    setBsBusy(true); setError(''); setSuggestions([]);
    try {
      const r = await fetch('/api/post/topics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: bsType, count: bsCount, keyword: bsKeyword, ...ctx, clinic }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setSuggestions((d.topics || []).map((t) => ({ ...t, _picked: true })));
    } catch (e) { setError('主題發想失敗:' + e.message); } finally { setBsBusy(false); }
  }
  function addPicked() {
    const picked = suggestions.filter((s) => s._picked);
    if (!picked.length) return;
    setTopics((arr) => [...arr, ...picked.map((s) => ({ id: newId(), type: s.type, name: s.name, prompt: s.prompt, enabled: true }))]);
    setSuggestions([]); setDirty(true); setSaveMsg('已加入,記得按「存檔到雲端」');
  }
  function updateTopic(id, patch) { setTopics((arr) => arr.map((t) => t.id === id ? { ...t, ...patch } : t)); setDirty(true); }
  function deleteTopic(id) { setTopics((arr) => arr.filter((t) => t.id !== id)); setDirty(true); }
  async function saveTopics() {
    setSaveMsg('儲存中…'); setError('');
    try {
      const r = await fetch('/api/topics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topics }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setDirty(false); setSaveMsg(`✓ 已存 ${d.count} 個主題`); setTimeout(() => setSaveMsg(''), 2500);
    } catch (e) { setSaveMsg(''); setError('存檔失敗:' + e.message); }
  }

  // ---- 批次產文 ----
  const selected = topics.find((t) => t.id === selId);
  async function generateBatch() {
    if (!selected) { setError('請先選一個主題'); return; }
    const n = Math.min(Math.max(Number(count) || 1, 1), 100);
    setGenBusy(true); setError(''); setActMsg(''); setGens([]); setGenProg({ done: 0, total: n });
    const results = new Array(n).fill(null);
    let done = 0, cursor = 0;
    const CONC = 3;
    async function worker() {
      while (cursor < n) {
        const i = cursor++;
        try {
          const r = await fetch('/api/post/write', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: selected.type, topicName: selected.name, prompt: selected.prompt, variant: i, ...ctx, clinic }) });
          const d = await r.json();
          results[i] = { id: `g-${i}-${Date.now()}`, text: r.ok ? (d.text || '') : `⚠ ${d.error || 'HTTP ' + r.status}`, keep: r.ok };
        } catch (e) { results[i] = { id: `g-${i}`, text: `⚠ ${e.message}`, keep: false }; }
        done++; setGenProg({ done, total: n });
        setGens(results.filter(Boolean));
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, n) }, worker));
    setGens(results.filter(Boolean));
    setGenBusy(false);
  }
  function updateGen(id, patch) { setGens((arr) => arr.map((g) => g.id === id ? { ...g, ...patch } : g)); }
  function removeGen(id) { setGens((arr) => arr.filter((g) => g.id !== id)); }
  const kept = gens.filter((g) => g.keep && g.text.trim() && !g.text.startsWith('⚠'));

  function scheduledTimes(nItems) {
    const slots = times.split(',').map((s) => s.trim()).filter(Boolean);
    const perDay = Math.max(slots.length, 1);
    const out = [];
    for (let i = 0; i < nItems; i++) {
      const day = Math.floor(i / perDay), slot = slots[i % perDay] || '12:00';
      const base = new Date(`${startDate}T${slot}:00`);
      base.setDate(base.getDate() + day);
      out.push(base.getTime());
    }
    return out;
  }
  async function sendToQueue() {
    if (!kept.length) { setError('沒有勾選要送的貼文'); return; }
    setActMsg('送排程中…'); setError('');
    try {
      const ts = scheduledTimes(kept.length);
      const items = kept.map((g, i) => ({ text: g.text, topicId: selected?.id || '', topicName: selected?.name || '', type: selected?.type || '', scheduledTs: ts[i] }));
      const r = await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', items }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setActMsg(`✓ 已送 ${d.added} 則到排程(從 ${startDate} 起,每天 ${times})`);
      setGens((arr) => arr.filter((g) => !g.keep));
    } catch (e) { setActMsg(''); setError('送排程失敗:' + e.message); }
  }
  async function postAllNow() {
    if (!kept.length) { setError('沒有勾選要發的貼文'); return; }
    if (!confirm(`確定立即發送 ${kept.length} 則到 Threads?`)) return;
    setActMsg('立即發送中…'); setError('');
    let ok = 0;
    for (const g of kept) {
      try {
        const r = await fetch('/api/threads/post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: g.text, topicId: selected?.id || '', topicName: selected?.name || '', type: selected?.type || '' }) });
        if (r.ok) { ok++; removeGen(g.id); }
      } catch (_) {}
      setActMsg(`發送中… ${ok}/${kept.length}`);
    }
    setActMsg(`✓ 已發 ${ok} 則`);
  }

  // ---- 排程 ----
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

  return (
    <main className="space-y-6">
      <div className="card border-brand-200 bg-brand-50/40">
        <h1 className="font-display text-2xl font-semibold text-sand-900">🧵 內容 / 發文</h1>
        <p className="mt-2 text-sm text-sand-600">主題庫 → 依主題批次產文(最多 100 則)→ 勾選送排程或立即發 → 排程到點自動發 Threads。品牌/療程自動帶入(在「品牌資訊」維護)。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[['library', '🗂 主題庫'], ['produce', '✍️ 批次產文'], ['queue', '🗓 排程']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-brand-600 text-white shadow-soft' : 'text-sand-600 hover:bg-brand-50'}`}>{l}</button>
          ))}
          <a href="/analytics" className="ml-auto rounded-full border border-sand-200 bg-white px-4 py-1.5 text-sm text-sand-600 hover:bg-brand-50">📊 成效分析</a>
        </div>
        <p className="mt-2 text-xs">{threadsConfigured === null ? '　' : threadsConfigured ? <span className="text-emerald-600">✓ Threads 已連接</span> : <span className="text-gold-600">⚠ Threads 未連接(可先產文＋複製;設 token 後可排程自動發)</span>}</p>
      </div>

      {tab === 'library' && (
        <>
          <div className="card space-y-3">
            <h2 className="font-display text-sm font-semibold text-sand-800">1. AI 推薦主題</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div><label className="label text-xs">型別</label>
                <div className="flex gap-1.5">{TYPES.map((t) => (<button key={t.key} type="button" onClick={() => setBsType(t.key)} className={`rounded-full border px-3 py-1 text-xs ${bsType === t.key ? 'border-brand-500 bg-brand-100 text-brand-800' : 'border-sand-200 bg-white text-sand-600 hover:bg-brand-50'}`}>{t.emoji} {t.label}</button>))}</div>
              </div>
              <div><label className="label text-xs">幾個</label><select className="input text-sm" value={bsCount} onChange={(e) => setBsCount(Number(e.target.value))}>{[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
              <div className="flex-1 min-w-[180px]"><label className="label text-xs">方向/關鍵字(選填)</label><input className="input text-sm" value={bsKeyword} onChange={(e) => setBsKeyword(e.target.value)} placeholder="例:海芙音波、通羅咖啡廳" /></div>
              <button type="button" onClick={brainstorm} disabled={bsBusy} className="btn-primary text-sm disabled:opacity-50">{bsBusy ? '發想中…' : '💡 AI 推薦'}</button>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2 border-t border-sand-200 pt-3">
                {suggestions.map((s, i) => (
                  <div key={i} className={`rounded-2xl border p-3 ${s._picked ? 'border-brand-300 bg-brand-50/50' : 'border-sand-200'}`}>
                    <label className="flex items-center gap-2 text-sm font-medium text-sand-800"><input type="checkbox" checked={s._picked} onChange={(e) => setSuggestions((arr) => arr.map((x, j) => j === i ? { ...x, _picked: e.target.checked } : x))} className="size-4 rounded border-sand-300 text-brand-600" />{typeMeta(s.type).emoji} {s.name}</label>
                    <textarea className="input mt-1 min-h-[46px] text-xs" value={s.prompt} onChange={(e) => setSuggestions((arr) => arr.map((x, j) => j === i ? { ...x, prompt: e.target.value } : x))} />
                  </div>
                ))}
                <button type="button" onClick={addPicked} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">＋ 加入所選到主題庫</button>
              </div>
            )}
          </div>
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-sand-800">2. 我的主題庫 <span className="font-normal text-sand-500">({topics.length})</span></h2>
              <div className="flex items-center gap-2">{saveMsg && <span className="text-xs text-emerald-600">{saveMsg}</span>}<button type="button" onClick={saveTopics} disabled={!dirty} className="btn-primary text-xs disabled:opacity-40">💾 存檔到雲端{dirty ? ' *' : ''}</button></div>
            </div>
            {topics.length === 0 && <p className="text-xs text-sand-400">還沒有主題,先用上方「AI 推薦」加入。</p>}
            <div className="space-y-2">
              {topics.map((t) => (
                <div key={t.id} className="rounded-2xl border border-sand-200 p-3">
                  <div className="flex items-center gap-2"><span className="rounded-full bg-gold-100 px-2 py-0.5 text-[11px] text-gold-700">{typeMeta(t.type).emoji} {typeMeta(t.type).label}</span><input className="input flex-1 text-sm" value={t.name} onChange={(e) => updateTopic(t.id, { name: e.target.value })} /><button type="button" onClick={() => deleteTopic(t.id)} className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50">🗑</button></div>
                  <textarea className="input mt-1 min-h-[46px] text-xs" value={t.prompt} placeholder="提示詞" onChange={(e) => updateTopic(t.id, { prompt: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'produce' && (
        <div className="card space-y-3">
          <h2 className="font-display text-sm font-semibold text-sand-800">依主題批次產文</h2>
          {topics.length === 0 ? <p className="text-xs text-sand-400">主題庫是空的,請先到「🗂 主題庫」新增並存檔。</p> : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]"><label className="label text-xs">選主題</label>
                  <select className="input text-sm" value={selId} onChange={(e) => { setSelId(e.target.value); setGens([]); }}>
                    <option value="">選一個主題…</option>
                    {TYPES.map((ty) => { const g = topics.filter((t) => t.type === ty.key && t.enabled !== false); return g.length ? <optgroup key={ty.key} label={`${ty.emoji} ${ty.label}`}>{g.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup> : null; })}
                  </select>
                </div>
                <div><label className="label text-xs">產幾則(≤100)</label><input type="number" min={1} max={100} className="input w-24 text-sm" value={count} onChange={(e) => setCount(e.target.value)} /></div>
                <button type="button" onClick={generateBatch} disabled={genBusy || !selected} className="btn-primary text-sm disabled:opacity-50">{genBusy ? `產文中 ${genProg.done}/${genProg.total}` : '✍️ 批次產文'}</button>
              </div>
              {selected && <p className="text-[11px] text-sand-500">提示詞:{selected.prompt || '(無)'}</p>}

              {gens.length > 0 && (
                <div className="space-y-3 border-t border-sand-200 pt-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium text-sand-700">共 {gens.length} 則,已勾 {kept.length} 則</span>
                    <button type="button" onClick={() => setGens((a) => a.map((g) => ({ ...g, keep: true })))} className="text-xs text-sand-500 hover:underline">全選</button>
                    <button type="button" onClick={() => setGens((a) => a.map((g) => ({ ...g, keep: false })))} className="text-xs text-sand-500 hover:underline">全不選</button>
                  </div>
                  <div className="space-y-2">
                    {gens.map((g, i) => (
                      <div key={g.id} className={`rounded-2xl border p-3 ${g.keep ? 'border-brand-300 bg-brand-50/40' : 'border-sand-200 opacity-70'}`}>
                        <div className="mb-1 flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-sand-600"><input type="checkbox" checked={g.keep} onChange={(e) => updateGen(g.id, { keep: e.target.checked })} className="size-4 rounded border-sand-300 text-brand-600" />第 {i + 1} 則 <span className={g.text.length > 500 ? 'text-red-600' : 'text-sand-400'}>({g.text.length}/500)</span></label>
                          <button type="button" onClick={() => removeGen(g.id)} className="rounded-lg px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">刪除</button>
                        </div>
                        <textarea className="input min-h-[90px] text-sm" value={g.text} onChange={(e) => updateGen(g.id, { text: e.target.value })} />
                      </div>
                    ))}
                  </div>

                  {/* 排程設定 + 動作 */}
                  <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3 space-y-2">
                    <div className="flex flex-wrap items-end gap-3">
                      <div><label className="label text-xs">起始日期</label><input type="date" className="input text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                      <div className="flex-1 min-w-[160px]"><label className="label text-xs">每天發文時段(逗號分隔,幾個=每天幾則)</label><input className="input text-sm" value={times} onChange={(e) => setTimes(e.target.value)} placeholder="12:00,20:00" /></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={sendToQueue} disabled={!kept.length} className="btn-primary text-sm disabled:opacity-50">🗓 送到排程({kept.length})</button>
                      <button type="button" onClick={postAllNow} disabled={!kept.length} className="btn-secondary text-sm disabled:opacity-50">🧵 立即發送所選</button>
                      {actMsg && <span className="text-xs text-emerald-700">{actMsg}</span>}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'queue' && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-sand-800">排程佇列 <span className="font-normal text-sand-500">({qItems.length})</span></h2>
            <div className="flex flex-wrap items-center gap-2">
              {qMsg && <span className="text-xs text-emerald-700">{qMsg}</span>}
              <button type="button" onClick={reviewPrices} className="btn-gold text-xs">🔄 更新未發價格</button>
              <button type="button" onClick={runDue} className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">▶ 立即檢查發送</button>
              <button type="button" onClick={clearPosted} className="btn-secondary text-xs">🧹 清除已發</button>
              <button type="button" onClick={loadQueue} disabled={qBusy} className="rounded-xl border border-sand-200 bg-white px-2 py-1.5 text-xs text-sand-500 hover:bg-brand-50">↻</button>
            </div>
          </div>
          <p className="text-[11px] text-sand-400">到期貼文由外部 cron 每小時打 <code>/api/cron/tick</code> 自動發;也可按「立即檢查發送」手動觸發。改完價格後,用「更新未發價格」把待發貼文的舊價換成新價。</p>

          {/* 每日自動產文開關 */}
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
          {qItems.length === 0 ? <p className="text-xs text-sand-400">佇列是空的。到「✍️ 批次產文」勾選後按「送到排程」。</p> : (
            <div className="space-y-1.5">
              {qItems.map((it) => (
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
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">❌ {error}</div>}
    </main>
  );
}
