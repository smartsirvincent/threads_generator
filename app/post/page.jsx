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

  useEffect(() => {
    (async () => { const canon = await loadCanonicalProfile(CANONICAL_PROFILE_NAME); if (canon?.products?.length) setProfile({ ...DEFAULT_PROFILE, ...canon }); })();
    (async () => { try { const r = await fetch('/api/topics', { cache: 'no-store' }); const d = await r.json(); setTopics(Array.isArray(d.topics) ? d.topics : []); } catch (_) {} })();
    (async () => { try { const r = await fetch('/api/threads/post', { cache: 'no-store' }); const d = await r.json(); setThreadsConfigured(!!d.configured); } catch (_) { setThreadsConfigured(false); } })();
  }, []);

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

  return (
    <main className="space-y-6">
      <div className="card border-sky-200 bg-sky-50/40">
        <h1 className="text-2xl font-semibold text-stone-900">🧵 內容 / 發文</h1>
        <p className="mt-2 text-sm text-stone-600">主題庫 → 依主題批次產文(最多 100 則)→ 勾選送排程或立即發 → 排程到點自動發 Threads。品牌/療程自動帶入(在「品牌資訊」維護)。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[['library', '🗂 主題庫'], ['produce', '✍️ 批次產文'], ['queue', '🗓 排程']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? 'bg-sky-600 text-white' : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}>{l}</button>
          ))}
          <a href="/analytics" className="ml-auto rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">📊 成效分析</a>
        </div>
        <p className="mt-2 text-xs">{threadsConfigured === null ? '　' : threadsConfigured ? <span className="text-emerald-600">✓ Threads 已連接</span> : <span className="text-amber-600">⚠ Threads 未連接(可先產文＋複製;設 token 後可排程自動發)</span>}</p>
      </div>

      {tab === 'library' && (
        <>
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-stone-800">1. AI 推薦主題</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div><label className="label text-xs">型別</label>
                <div className="flex gap-1.5">{TYPES.map((t) => (<button key={t.key} type="button" onClick={() => setBsType(t.key)} className={`rounded-md border px-2.5 py-1 text-xs ${bsType === t.key ? 'border-sky-500 bg-sky-100 text-sky-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>{t.emoji} {t.label}</button>))}</div>
              </div>
              <div><label className="label text-xs">幾個</label><select className="input text-sm" value={bsCount} onChange={(e) => setBsCount(Number(e.target.value))}>{[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
              <div className="flex-1 min-w-[180px]"><label className="label text-xs">方向/關鍵字(選填)</label><input className="input text-sm" value={bsKeyword} onChange={(e) => setBsKeyword(e.target.value)} placeholder="例:海芙音波、通羅咖啡廳" /></div>
              <button type="button" onClick={brainstorm} disabled={bsBusy} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{bsBusy ? '發想中…' : '💡 AI 推薦'}</button>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2 border-t border-stone-200 pt-3">
                {suggestions.map((s, i) => (
                  <div key={i} className={`rounded-lg border p-2 ${s._picked ? 'border-sky-300 bg-sky-50/50' : 'border-stone-200'}`}>
                    <label className="flex items-center gap-2 text-sm font-medium text-stone-800"><input type="checkbox" checked={s._picked} onChange={(e) => setSuggestions((arr) => arr.map((x, j) => j === i ? { ...x, _picked: e.target.checked } : x))} className="size-4 rounded border-stone-300 text-sky-600" />{typeMeta(s.type).emoji} {s.name}</label>
                    <textarea className="input mt-1 min-h-[46px] text-xs" value={s.prompt} onChange={(e) => setSuggestions((arr) => arr.map((x, j) => j === i ? { ...x, prompt: e.target.value } : x))} />
                  </div>
                ))}
                <button type="button" onClick={addPicked} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">＋ 加入所選到主題庫</button>
              </div>
            )}
          </div>
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-800">2. 我的主題庫 <span className="font-normal text-stone-500">({topics.length})</span></h2>
              <div className="flex items-center gap-2">{saveMsg && <span className="text-xs text-emerald-600">{saveMsg}</span>}<button type="button" onClick={saveTopics} disabled={!dirty} className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40">💾 存檔到雲端{dirty ? ' *' : ''}</button></div>
            </div>
            {topics.length === 0 && <p className="text-xs text-stone-400">還沒有主題,先用上方「AI 推薦」加入。</p>}
            <div className="space-y-2">
              {topics.map((t) => (
                <div key={t.id} className="rounded-lg border border-stone-200 p-2">
                  <div className="flex items-center gap-2"><span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">{typeMeta(t.type).emoji} {typeMeta(t.type).label}</span><input className="input flex-1 text-sm" value={t.name} onChange={(e) => updateTopic(t.id, { name: e.target.value })} /><button type="button" onClick={() => deleteTopic(t.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">🗑</button></div>
                  <textarea className="input mt-1 min-h-[46px] text-xs" value={t.prompt} placeholder="提示詞" onChange={(e) => updateTopic(t.id, { prompt: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'produce' && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-stone-800">依主題批次產文</h2>
          {topics.length === 0 ? <p className="text-xs text-stone-400">主題庫是空的,請先到「🗂 主題庫」新增並存檔。</p> : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]"><label className="label text-xs">選主題</label>
                  <select className="input text-sm" value={selId} onChange={(e) => { setSelId(e.target.value); setGens([]); }}>
                    <option value="">選一個主題…</option>
                    {TYPES.map((ty) => { const g = topics.filter((t) => t.type === ty.key && t.enabled !== false); return g.length ? <optgroup key={ty.key} label={`${ty.emoji} ${ty.label}`}>{g.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</optgroup> : null; })}
                  </select>
                </div>
                <div><label className="label text-xs">產幾則(≤100)</label><input type="number" min={1} max={100} className="input w-24 text-sm" value={count} onChange={(e) => setCount(e.target.value)} /></div>
                <button type="button" onClick={generateBatch} disabled={genBusy || !selected} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{genBusy ? `產文中 ${genProg.done}/${genProg.total}` : '✍️ 批次產文'}</button>
              </div>
              {selected && <p className="text-[11px] text-stone-500">提示詞:{selected.prompt || '(無)'}</p>}

              {gens.length > 0 && (
                <div className="space-y-3 border-t border-stone-200 pt-3">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium text-stone-700">共 {gens.length} 則,已勾 {kept.length} 則</span>
                    <button type="button" onClick={() => setGens((a) => a.map((g) => ({ ...g, keep: true })))} className="text-xs text-stone-500 hover:underline">全選</button>
                    <button type="button" onClick={() => setGens((a) => a.map((g) => ({ ...g, keep: false })))} className="text-xs text-stone-500 hover:underline">全不選</button>
                  </div>
                  <div className="space-y-2">
                    {gens.map((g, i) => (
                      <div key={g.id} className={`rounded-lg border p-2 ${g.keep ? 'border-sky-300 bg-sky-50/40' : 'border-stone-200 opacity-70'}`}>
                        <div className="mb-1 flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={g.keep} onChange={(e) => updateGen(g.id, { keep: e.target.checked })} className="size-4 rounded border-stone-300 text-sky-600" />第 {i + 1} 則 <span className={g.text.length > 500 ? 'text-red-600' : 'text-stone-400'}>({g.text.length}/500)</span></label>
                          <button type="button" onClick={() => removeGen(g.id)} className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">刪除</button>
                        </div>
                        <textarea className="input min-h-[90px] text-sm" value={g.text} onChange={(e) => updateGen(g.id, { text: e.target.value })} />
                      </div>
                    ))}
                  </div>

                  {/* 排程設定 + 動作 */}
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
                    <div className="flex flex-wrap items-end gap-3">
                      <div><label className="label text-xs">起始日期</label><input type="date" className="input text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                      <div className="flex-1 min-w-[160px]"><label className="label text-xs">每天發文時段(逗號分隔,幾個=每天幾則)</label><input className="input text-sm" value={times} onChange={(e) => setTimes(e.target.value)} placeholder="12:00,20:00" /></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={sendToQueue} disabled={!kept.length} className="rounded-md bg-purple-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">🗓 送到排程({kept.length})</button>
                      <button type="button" onClick={postAllNow} disabled={!kept.length} className="rounded-md bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50">🧵 立即發送所選</button>
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
            <h2 className="text-sm font-semibold text-stone-800">排程佇列 <span className="font-normal text-stone-500">({qItems.length})</span></h2>
            <div className="flex items-center gap-2">
              {qMsg && <span className="text-xs text-emerald-700">{qMsg}</span>}
              <button type="button" onClick={runDue} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">▶ 立即檢查發送</button>
              <button type="button" onClick={clearPosted} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50">🧹 清除已發</button>
              <button type="button" onClick={loadQueue} disabled={qBusy} className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-500 hover:bg-stone-50">↻</button>
            </div>
          </div>
          <p className="text-[11px] text-stone-400">每小時整點會自動檢查並發送到期貼文(Vercel Cron);也可按「立即檢查發送」手動觸發。</p>
          {qItems.length === 0 ? <p className="text-xs text-stone-400">佇列是空的。到「✍️ 批次產文」勾選後按「送到排程」。</p> : (
            <div className="space-y-1.5">
              {qItems.map((it) => (
                <div key={it.id} className="flex items-start gap-2 rounded-lg border border-stone-200 p-2 text-xs">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 ${it.status === 'posted' ? 'bg-emerald-100 text-emerald-700' : it.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{it.status === 'posted' ? '已發' : it.status === 'failed' ? '失敗' : '待發'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-stone-500">{new Date(it.scheduledTs).toLocaleString('zh-TW')} · {it.topicName || '—'}</div>
                    <div className="truncate text-stone-800">{it.text}</div>
                    {it.status === 'posted' && it.permalink && <a href={it.permalink} target="_blank" rel="noreferrer" className="text-sky-600 underline">看貼文 ↗</a>}
                    {it.status === 'failed' && <span className="text-red-600">{it.error}</span>}
                  </div>
                  <button type="button" onClick={() => removeQ(it.id)} className="shrink-0 rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50">🗑</button>
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
