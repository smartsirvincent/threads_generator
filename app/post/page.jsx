'use client';

// 內容 / 發文:主題庫(3型別+提示詞+存檔) → 依主題批次產文(≤100)→ 勾選送排程 / 立即發。排程與連線各自獨立成頁。
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
  const [timeSlots, setTimeSlots] = useState(['12:00', '20:00']);
  const [qCursor, setQCursor] = useState(0); // 排程時段游標,單筆/批次送排程時往後遞延
  const [actMsg, setActMsg] = useState('');

  // 預約發文(天氣)
  const nowTime = () => { const d = new Date(); d.setHours(d.getHours() + 1); return `${String(d.getHours()).padStart(2, '0')}:00`; };
  const [wxBusy, setWxBusy] = useState(false);
  const [wx, setWx] = useState(null);        // {weather, weatherLine}
  const [wxText, setWxText] = useState('');
  const [wxDate, setWxDate] = useState(todayStr());
  const [wxTime, setWxTime] = useState(nowTime());
  const [wxMsg, setWxMsg] = useState('');

  useEffect(() => {
    (async () => { const canon = await loadCanonicalProfile(CANONICAL_PROFILE_NAME); if (canon?.products?.length) setProfile({ ...DEFAULT_PROFILE, ...canon }); })();
    (async () => { try { const r = await fetch('/api/topics', { cache: 'no-store' }); const d = await r.json(); setTopics(Array.isArray(d.topics) ? d.topics : []); } catch (_) {} })();
    (async () => { try { const r = await fetch('/api/threads/post', { cache: 'no-store' }); const d = await r.json(); setThreadsConfigured(!!d.configured); } catch (_) { setThreadsConfigured(false); } })();
  }, []);

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
  function addManualTopic() { setTopics((arr) => [{ id: newId(), type: 'text', name: '', prompt: '', imagePrompt: '', useLogo: false, enabled: true }, ...arr]); setDirty(true); setSaveMsg('已新增空白主題,填好後按存檔'); }
  function insertToPrompt(id, field, text) { setTopics((arr) => arr.map((t) => t.id === id ? { ...t, [field]: ((t[field] || '').trim() ? (t[field].trim() + '，') : '') + text } : t)); setDirty(true); }
  async function saveTopics() {
    setSaveMsg('儲存中…'); setError('');
    try {
      const r = await fetch('/api/topics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topics }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setDirty(false); setSaveMsg(`✓ 已存 ${d.count} 個主題`); setTimeout(() => setSaveMsg(''), 2500);
    } catch (e) { setSaveMsg(''); setError('存檔失敗:' + e.message); }
  }

  // 提示詞可插入的療程(帶價)、變數、方向靈感
  const treatments = (profile.products || []).filter((p) => p && p.name).map((p) => ({ name: p.name, price: p.promo_offer || '' }));
  const VARS = ['每人 5,000 醫美券直接抵', '逐句翻譯零溝通障礙', '回台後 LINE 隨時問', '自有醫師不是租的', '曼谷景點順遊', '術後照護提醒'];
  const DIRECTIONS = ['破除迷思', '真實心得', '價格划算', '適合誰/不適合', '術後照護', '曼谷順遊', '閨蜜見證', '諮詢常見問答'];

  // 依主題綁定的療程 + 混用方式,排出「取用清單」(輪流=各一次;比例=依權重重複)
  function buildTreatmentPickList(topic) {
    const names = topic?.treatments || [];
    const prods = names.map((nm) => (profile.products || []).find((p) => p.name === nm)).filter(Boolean);
    if (!prods.length) return [];
    if (topic.mix === 'weight') {
      const list = [];
      for (const p of prods) { const w = Math.max(1, Number(topic.weights?.[p.name]) || 1); for (let k = 0; k < w; k++) list.push(p); }
      return list;
    }
    return prods;
  }
  // 依「要帶入哪些變數」把該療程資訊組成文字(給文案/圖片提示詞用)
  function buildTreatmentContext(topic, p) {
    if (!p) return '';
    const inj = topic.inject || {};
    const parts = [];
    if (inj.name !== false) parts.push(`療程名稱:${p.name}`);
    if (inj.price !== false && p.promo_offer) parts.push(`價格優惠:${p.promo_offer}`);
    if (p.features) parts.push(`特點:${p.features}`);
    if (inj.imageFocus !== false && p.image_focus) parts.push(`強化圖片方向:${p.image_focus}`);
    return parts.join('\n');
  }

  // ---- 批次產文 ----
  const selected = topics.find((t) => t.id === selId);
  async function generateBatch() {
    if (!selected) { setError('請先選一個主題'); return; }
    const n = Math.min(Math.max(Number(count) || 1, 1), 100);
    setGenBusy(true); setError(''); setActMsg(''); setGens([]); setGenProg({ done: 0, total: n });
    const results = new Array(n).fill(null);
    const seedBase = Math.floor(Math.random() * 210); // 每批隨機起點,批間也不同(210=各軸長度 LCM)
    // 綁定療程:依「輪流 / 指定比例」排出取用清單,產文時輪替帶入
    const pickList = buildTreatmentPickList(selected);
    let done = 0, cursor = 0;
    const CONC = 3;
    async function worker() {
      while (cursor < n) {
        const i = cursor++;
        const tp = pickList.length ? pickList[(seedBase + i) % pickList.length] : null;
        const treatmentContext = buildTreatmentContext(selected, tp);
        try {
          const r = await fetch('/api/post/write', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: selected.type, topicName: selected.name, prompt: selected.prompt, variant: seedBase + i, seriesIndex: i + 1, seriesTotal: n, treatmentContext, ...ctx, clinic }) });
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

  // 時段設定
  function updateSlot(i, v) { setTimeSlots((arr) => arr.map((s, j) => j === i ? v : s)); }
  function addSlot() { setTimeSlots((arr) => [...arr, '18:00']); }
  function removeSlot(i) { setTimeSlots((arr) => arr.length > 1 ? arr.filter((_, j) => j !== i) : arr); }

  // 依游標往後排出 n 個時段(單筆/批次共用,避免撞在同一時間)
  function takeSlots(n) {
    const slots = timeSlots.filter(Boolean);
    const perDay = Math.max(slots.length, 1);
    const out = [];
    for (let k = 0; k < n; k++) {
      const idx = qCursor + k, day = Math.floor(idx / perDay), slot = slots[idx % perDay] || '12:00';
      const base = new Date(`${startDate}T${slot}:00`);
      base.setDate(base.getDate() + day);
      out.push(base.getTime());
    }
    setQCursor(qCursor + n);
    return out;
  }

  const gmeta = () => ({ topicId: selected?.id || '', topicName: selected?.name || '', type: selected?.type || '' });
  function badGen(g) { return !g.text.trim() || g.text.startsWith('⚠'); }

  // 單筆:存入排程(meta 可覆寫;scheduledTs 可指定,否則依時段游標)
  async function queueOne(g, meta, ts) {
    if (badGen(g)) { setError('這則內容無效,無法排程'); return false; }
    const when = ts || takeSlots(1)[0];
    try {
      const r = await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', items: [{ text: g.text, ...(meta || gmeta()), scheduledTs: when }] }) });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      if (!meta) removeGen(g.id);
      setActMsg(`✓ 已排程 1 則(${new Date(when).toLocaleString('zh-TW')})`);
      return true;
    } catch (e) { setError('排程失敗:' + e.message); return false; }
  }
  // 單筆:立即發文(meta 可覆寫)
  async function postOne(g, meta) {
    if (badGen(g)) { setError('這則內容無效,無法發送'); return false; }
    if (!confirm('確定立即發送這則到 Threads?')) return false;
    setActMsg('發送中…');
    try {
      const r = await fetch('/api/threads/post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: g.text, ...(meta || gmeta()) }) });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      if (!meta) removeGen(g.id);
      setActMsg('✓ 已發送 1 則');
      return true;
    } catch (e) { setActMsg(''); setError('發送失敗:' + e.message); return false; }
  }
  // 批次:全部送排程
  async function sendToQueue() {
    if (!kept.length) { setError('沒有勾選要送的貼文'); return; }
    setActMsg('送排程中…'); setError('');
    try {
      const ts = takeSlots(kept.length);
      const items = kept.map((g, i) => ({ text: g.text, ...gmeta(), scheduledTs: ts[i] }));
      const r = await fetch('/api/queue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', items }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setActMsg(`✓ 已送 ${d.added} 則到排程 — 到「🗓 排程」查看`);
      setGens((arr) => arr.filter((g) => !g.keep));
    } catch (e) { setActMsg(''); setError('送排程失敗:' + e.message); }
  }
  // ---- 預約發文(天氣) ----
  const WX_META = { topicId: '', topicName: '曼谷天氣提醒', type: 'text' };
  async function genWeatherPost() {
    setWxBusy(true); setWxMsg('抓曼谷天氣＋產文中…'); setError('');
    try {
      const r = await fetch('/api/post/weather', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...ctx, clinic }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setWx({ weather: d.weather, weatherLine: d.weatherLine }); setWxText(d.text || ''); setWxMsg('');
    } catch (e) { setWxMsg(''); setError('天氣產文失敗:' + e.message); } finally { setWxBusy(false); }
  }
  async function postWeatherNow() {
    const ok = await postOne({ id: 'wx', text: wxText }, WX_META);
    if (ok) { setWxText(''); setWx(null); }
  }
  async function queueWeather() {
    if (!wxText.trim()) { setError('沒有可預約的內容'); return; }
    const ts = new Date(`${wxDate}T${wxTime}:00`).getTime();
    if (!ts || ts < Date.now()) { setError('預約時間需晚於現在'); return; }
    const ok = await queueOne({ id: 'wx', text: wxText }, WX_META, ts);
    if (ok) { setWxText(''); setWx(null); setWxMsg('✓ 已預約,到「🗓 排程」查看'); }
  }

  // 批次:全部立即發
  async function postAllNow() {
    if (!kept.length) { setError('沒有勾選要發的貼文'); return; }
    if (!confirm(`確定立即發送 ${kept.length} 則到 Threads?`)) return;
    setActMsg('立即發送中…'); setError('');
    let ok = 0;
    for (const g of kept) {
      try {
        const r = await fetch('/api/threads/post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: g.text, ...gmeta() }) });
        if (r.ok) { ok++; removeGen(g.id); }
      } catch (_) {}
      setActMsg(`發送中… ${ok}/${kept.length}`);
    }
    setActMsg(`✓ 已發 ${ok} 則`);
  }

  return (
    <main className="space-y-6">
      <div className="card border-brand-200 bg-brand-50/40">
        <h1 className="font-display text-2xl font-semibold text-sand-900">🧵 內容 / 發文</h1>
        <p className="mt-2 text-sm text-sand-600">建立主題 → 依主題產文(最多 100 則)→ 每則可立即發、存排程或刪除。品牌／療程自動帶入(在「品牌與療程」維護)。排程與連線各自獨立成頁。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[['library', '🗂 建立主題'], ['produce', '✍️ 主題產文'], ['weather', '🌤 預約發文']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? 'bg-brand-600 text-white shadow-soft' : 'text-sand-600 hover:bg-brand-50'}`}>{l}</button>
          ))}
          <a href="/schedule" className="ml-auto rounded-full border border-sand-200 bg-white px-4 py-1.5 text-sm text-sand-600 hover:bg-brand-50">🗓 排程</a>
          <a href="/analytics" className="rounded-full border border-sand-200 bg-white px-4 py-1.5 text-sm text-sand-600 hover:bg-brand-50">📊 成效分析</a>
        </div>
        <p className="mt-2 text-xs">{threadsConfigured === null ? '　' : threadsConfigured ? <span className="text-emerald-600">✓ Threads 已連接</span> : <span className="text-gold-600">⚠ Threads 未連接 — 到「連線設定」設好 token 才能排程自動發(可先產文＋複製)</span>}</p>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold text-sand-800">2. 我的主題庫 <span className="font-normal text-sand-500">({topics.length})</span></h2>
              <div className="flex items-center gap-2">
                {saveMsg && <span className="text-xs text-emerald-600">{saveMsg}</span>}
                <button type="button" onClick={addManualTopic} className="btn-secondary text-xs">＋ 手動新增主題</button>
                <button type="button" onClick={saveTopics} disabled={!dirty} className="btn-primary text-xs disabled:opacity-40">💾 存檔到雲端{dirty ? ' *' : ''}</button>
              </div>
            </div>
            <p className="rounded-xl bg-sand-50 px-3 py-2 text-[11px] leading-relaxed text-sand-500">
              提示詞方向靈感:{DIRECTIONS.join('、')}。可插入變數:療程名＋價格、5,000 醫美券、逐句翻譯、自有醫師、曼谷順遊等(見各欄下方按鈕)。提示詞寫成「方向＋多個可選角度」最好,不要寫死固定開場/結尾,系列才不會每篇都一樣。
            </p>
            {topics.length === 0 && <p className="text-xs text-sand-400">還沒有主題,用上方「AI 推薦」或「手動新增主題」建立。</p>}
            <div className="space-y-3">
              {topics.map((t) => (
                <div key={t.id} className="rounded-2xl border border-sand-200 p-3 space-y-2">
                  {/* 型別 + 名稱 + 啟用 + 刪除 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="input w-auto py-1.5 text-xs" value={t.type} onChange={(e) => updateTopic(t.id, { type: e.target.value })}>
                      {TYPES.map((ty) => <option key={ty.key} value={ty.key}>{ty.emoji} {ty.label}</option>)}
                    </select>
                    <input className="input flex-1 min-w-[140px] text-sm" value={t.name} placeholder="主題名稱(≤10字)" onChange={(e) => updateTopic(t.id, { name: e.target.value })} />
                    <label className="flex items-center gap-1 text-[11px] text-sand-500"><input type="checkbox" checked={t.enabled !== false} onChange={(e) => updateTopic(t.id, { enabled: e.target.checked })} className="size-3.5 rounded border-sand-300 text-brand-600" />啟用</label>
                    <button type="button" onClick={() => deleteTopic(t.id)} className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50">🗑</button>
                  </div>

                  {/* 文案提示詞 */}
                  <div>
                    <label className="label text-[11px]">文案提示詞</label>
                    <textarea className="input min-h-[60px] text-xs" value={t.prompt} placeholder="給產文 AI 的方向與可選角度(不要寫死固定開場/結尾)" onChange={(e) => updateTopic(t.id, { prompt: e.target.value })} />
                    <InsertBar treatments={treatments} vars={VARS} dirs={DIRECTIONS} onInsert={(text) => insertToPrompt(t.id, 'prompt', text)} />
                  </div>

                  {/* 圖片提示詞 + LOGO */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="label text-[11px]">圖片提示詞(圖片型可用)</label>
                      <label className="flex items-center gap-1 text-[11px] text-sand-600"><input type="checkbox" checked={!!t.useLogo} onChange={(e) => updateTopic(t.id, { useLogo: e.target.checked })} className="size-3.5 rounded border-sand-300 text-brand-600" />🅛 圖片帶 LOGO</label>
                    </div>
                    <textarea className="input min-h-[48px] text-xs" value={t.imagePrompt || ''} placeholder="圖片畫面方向:美麗東方女性搭配療程名稱/特點/價格,不要出現產品或儀器" onChange={(e) => updateTopic(t.id, { imagePrompt: e.target.value })} />
                    <InsertBar treatments={treatments} vars={[]} dirs={[]} onInsert={(text) => insertToPrompt(t.id, 'imagePrompt', text)} />
                  </div>

                  {/* 綁定療程:複選 + 輪流/比例 + 帶入變數 */}
                  <TreatmentBinder allProducts={profile.products || []} topic={t} onChange={(patch) => updateTopic(t.id, patch)} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'produce' && (
        <div className="card space-y-3">
          <h2 className="font-display text-sm font-semibold text-sand-800">依主題產文</h2>
          {topics.length === 0 ? <p className="text-xs text-sand-400">還沒有主題,請先到「🗂 建立主題」新增並存檔。</p> : (
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
                        </div>
                        <textarea className="input min-h-[90px] text-sm" value={g.text} onChange={(e) => updateGen(g.id, { text: e.target.value })} />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => postOne(g)} disabled={badGen(g)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40">🧵 立即發文</button>
                          <button type="button" onClick={() => queueOne(g)} disabled={badGen(g)} className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">🗓 存入排程</button>
                          <button type="button" onClick={() => removeGen(g.id)} className="rounded-lg border border-sand-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">🗑 刪除</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 排程設定(時段用挑的,不用填) + 批次動作 */}
                  <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3 space-y-3">
                    <div className="flex flex-wrap items-end gap-4">
                      <div><label className="label text-xs">起始日期</label><input type="date" className="input text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                      <div className="flex-1 min-w-[220px]">
                        <label className="label text-xs">每天發文時段(挑選,幾個=每天幾則)</label>
                        <div className="flex flex-wrap items-center gap-2">
                          {timeSlots.map((s, i) => (
                            <span key={i} className="flex items-center gap-1 rounded-xl border border-sand-200 bg-white pl-2 pr-1 py-1">
                              <input type="time" value={s} onChange={(e) => updateSlot(i, e.target.value)} className="bg-transparent text-sm text-sand-800 outline-none" />
                              {timeSlots.length > 1 && <button type="button" onClick={() => removeSlot(i)} className="rounded px-1 text-xs text-sand-400 hover:text-red-600">✕</button>}
                            </span>
                          ))}
                          <button type="button" onClick={addSlot} className="rounded-xl border border-dashed border-brand-300 px-2.5 py-1 text-xs text-brand-600 hover:bg-brand-50">＋ 加時段</button>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-sand-400">批次動作依「已勾選」的則數,從起始日期起、每天照上面時段依序排入。單則也可用各則自己的按鈕處理。</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={sendToQueue} disabled={!kept.length} className="btn-primary text-sm disabled:opacity-50">🗓 已勾選送排程({kept.length})</button>
                      <button type="button" onClick={postAllNow} disabled={!kept.length} className="btn-secondary text-sm disabled:opacity-50">🧵 已勾選立即發</button>
                      {actMsg && <span className="text-xs text-emerald-700">{actMsg}</span>}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'weather' && (
        <div className="card space-y-3">
          <h2 className="font-display text-sm font-semibold text-sand-800">🌤 預約發文 · 曼谷天氣提醒</h2>
          <p className="text-xs text-sand-500">串接曼谷當天天氣(氣溫／濕度／紫外線／降雨),自動產出「注意事項＋保養／術後照護」貼文。可立即發或預約時間發。</p>
          <button type="button" onClick={genWeatherPost} disabled={wxBusy} className="btn-primary text-sm disabled:opacity-50">{wxBusy ? '產生中…' : '🌤 抓天氣並產文'}</button>
          {wxMsg && <p className="text-xs text-emerald-700">{wxMsg}</p>}

          {wx?.weather && (
            <div className="flex flex-wrap gap-2 rounded-2xl border border-brand-200 bg-brand-50/40 p-3 text-xs text-sand-700">
              <span className="font-medium text-brand-700">曼谷今日</span>
              <span>{wx.weather.desc}</span>
              {wx.weather.tempMin != null && <span>🌡 {wx.weather.tempMin}–{wx.weather.tempMax}°C</span>}
              {wx.weather.humidity != null && <span>💧 濕度 {wx.weather.humidity}%</span>}
              {wx.weather.uvMax != null && <span>☀️ UV {wx.weather.uvMax}</span>}
              {wx.weather.precipProb != null && <span>🌧 降雨 {wx.weather.precipProb}%</span>}
            </div>
          )}

          {wxText && (
            <div className="space-y-3 border-t border-sand-200 pt-3">
              <div>
                <label className="label text-xs">貼文內容 <span className={wxText.length > 500 ? 'text-red-600' : 'text-sand-400'}>({wxText.length}/500)</span></label>
                <textarea className="input min-h-[120px] text-sm" value={wxText} onChange={(e) => setWxText(e.target.value)} />
              </div>
              <div className="rounded-2xl border border-sand-200 bg-sand-50 p-3 space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div><label className="label text-xs">預約日期</label><input type="date" className="input text-sm" value={wxDate} onChange={(e) => setWxDate(e.target.value)} /></div>
                  <div><label className="label text-xs">預約時間</label><input type="time" className="input text-sm" value={wxTime} onChange={(e) => setWxTime(e.target.value)} /></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={postWeatherNow} disabled={!wxText.trim()} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40">🧵 立即發文</button>
                  <button type="button" onClick={queueWeather} disabled={!wxText.trim()} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">🗓 預約發文</button>
                  <button type="button" onClick={() => { setWxText(''); setWx(null); }} className="rounded-lg border border-sand-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">🗑 刪除</button>
                  {actMsg && <span className="text-xs text-emerald-700">{actMsg}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">❌ {error}</div>}
    </main>
  );
}

// 綁定療程:複選療程 + 輪流/指定比例 + 選擇要帶入的變數
function TreatmentBinder({ allProducts, topic, onChange }) {
  const [open, setOpen] = useState(false);
  const sel = topic.treatments || [];
  const inj = topic.inject || {};
  const mix = topic.mix || 'rotate';
  function toggle(name) {
    const next = sel.includes(name) ? sel.filter((n) => n !== name) : [...sel, name];
    onChange({ treatments: next });
  }
  function setWeight(name, v) { onChange({ weights: { ...(topic.weights || {}), [name]: Math.max(1, Number(v) || 1) } }); }
  function setInject(k, v) { onChange({ inject: { name: inj.name !== false, price: inj.price !== false, imageFocus: inj.imageFocus !== false, [k]: v } }); }
  return (
    <div className="rounded-xl border border-sand-200 bg-sand-50/60 p-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between text-left text-[11px] font-medium text-sand-700">
        <span>💉 綁定療程{sel.length ? ` (${sel.length})` : '(未綁定)'}</span>
        <span className="text-sand-400">{open ? '收合 ▾' : '展開 ▸'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {allProducts.filter((p) => p && p.name).map((p) => {
              const on = sel.includes(p.name);
              return (
                <button key={p.name} type="button" onClick={() => toggle(p.name)} className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? 'border-brand-400 bg-brand-100 text-brand-800' : 'border-sand-200 bg-white text-sand-500 hover:bg-brand-50'}`}>
                  {on ? '✓ ' : ''}{p.name}
                </button>
              );
            })}
            {allProducts.length === 0 && <span className="text-[11px] text-sand-400">品牌療程庫是空的(到「品牌與療程」新增)。</span>}
          </div>
          {sel.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-sand-600">
                <span>取用方式:</span>
                <label className="flex items-center gap-1"><input type="radio" checked={mix === 'rotate'} onChange={() => onChange({ mix: 'rotate' })} />輪流</label>
                <label className="flex items-center gap-1"><input type="radio" checked={mix === 'weight'} onChange={() => onChange({ mix: 'weight' })} />指定強化比例</label>
              </div>
              {mix === 'weight' && (
                <div className="flex flex-wrap gap-2">
                  {sel.map((n) => (
                    <span key={n} className="flex items-center gap-1 rounded-lg border border-sand-200 bg-white px-2 py-0.5 text-[11px] text-sand-700">
                      {n}<input type="number" min={1} max={9} value={topic.weights?.[n] || 1} onChange={(e) => setWeight(n, e.target.value)} className="w-10 rounded border border-sand-200 px-1 text-center" />倍
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-sand-600">
                <span>帶入變數:</span>
                <label className="flex items-center gap-1"><input type="checkbox" checked={inj.name !== false} onChange={(e) => setInject('name', e.target.checked)} />療程名稱</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={inj.price !== false} onChange={(e) => setInject('price', e.target.checked)} />價格優惠</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={inj.imageFocus !== false} onChange={(e) => setInject('imageFocus', e.target.checked)} />強化圖片方向</label>
              </div>
              <p className="text-[11px] text-sand-400">產文時會依上面設定,輪替把所選療程的名稱／價格／圖片方向自動帶進文案(與圖片)提示詞,同批不同篇帶不同療程。</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 提示詞插入列:點療程(帶價)/變數/方向,把文字接到對應提示詞
function InsertBar({ treatments, vars, dirs, onInsert }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {treatments.length > 0 && (
        <select className="rounded-lg border border-sand-200 bg-white px-1.5 py-1 text-[11px] text-sand-600" value="" onChange={(e) => { const p = treatments.find((x) => x.name === e.target.value); if (p) onInsert(p.price ? `「${p.name}」(參考價:${p.price})` : `「${p.name}」`); e.target.value = ''; }}>
          <option value="">＋療程/價格…</option>
          {treatments.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
      )}
      {(vars || []).map((v) => (
        <button key={v} type="button" onClick={() => onInsert(v)} className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700 hover:bg-brand-100">＋{v}</button>
      ))}
      {(dirs || []).map((d) => (
        <button key={d} type="button" onClick={() => onInsert(`可從「${d}」角度切入`)} className="rounded-full border border-sand-200 bg-white px-2 py-0.5 text-[11px] text-sand-500 hover:bg-sand-50">#{d}</button>
      ))}
    </div>
  );
}
