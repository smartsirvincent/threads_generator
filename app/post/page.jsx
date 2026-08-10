'use client';

// 內容流程:主題庫(AI 推薦 3 型別 → 確認 + 可改提示詞 → 存檔)→ 依主題產文 → 發 Threads
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
  const [text, setText] = useState('');
  const [writeBusy, setWriteBusy] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const canon = await loadCanonicalProfile(CANONICAL_PROFILE_NAME);
      if (canon?.products?.length) setProfile({ ...DEFAULT_PROFILE, ...canon });
    })();
    (async () => {
      try { const r = await fetch('/api/topics', { cache: 'no-store' }); const d = await r.json(); setTopics(Array.isArray(d.topics) ? d.topics : []); } catch (_) {}
    })();
    (async () => {
      try { const r = await fetch('/api/threads/post', { cache: 'no-store' }); const d = await r.json(); setThreadsConfigured(!!d.configured); } catch (_) { setThreadsConfigured(false); }
    })();
  }, []);

  async function brainstorm() {
    setBsBusy(true); setError(''); setSuggestions([]);
    try {
      const r = await fetch('/api/post/topics', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: bsType, count: bsCount, keyword: bsKeyword, ...ctx, clinic }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setSuggestions((d.topics || []).map((t) => ({ ...t, _picked: true })));
    } catch (e) { setError('主題發想失敗:' + e.message); }
    finally { setBsBusy(false); }
  }

  function addPicked() {
    const picked = suggestions.filter((s) => s._picked);
    if (picked.length === 0) return;
    setTopics((arr) => [...arr, ...picked.map((s) => ({ id: newId(), type: s.type, name: s.name, prompt: s.prompt, enabled: true }))]);
    setSuggestions([]);
    setDirty(true);
    setSaveMsg('已加入,記得按「存檔到雲端」');
  }

  function updateTopic(id, patch) { setTopics((arr) => arr.map((t) => t.id === id ? { ...t, ...patch } : t)); setDirty(true); }
  function deleteTopic(id) { setTopics((arr) => arr.filter((t) => t.id !== id)); setDirty(true); }

  async function saveTopics() {
    setSaveMsg('儲存中…'); setError('');
    try {
      const r = await fetch('/api/topics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ topics }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setDirty(false); setSaveMsg(`✓ 已存 ${d.count} 個主題到雲端`);
      setTimeout(() => setSaveMsg(''), 2500);
    } catch (e) { setSaveMsg(''); setError('存檔失敗:' + e.message); }
  }

  const selected = topics.find((t) => t.id === selId);

  async function produce() {
    if (!selected) { setError('請先選一個主題'); return; }
    setWriteBusy(true); setError(''); setPostResult(null);
    try {
      const r = await fetch('/api/post/write', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: selected.type, topicName: selected.name, prompt: selected.prompt, ...ctx, clinic }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setText(d.text || '');
    } catch (e) { setError('產文失敗:' + e.message); }
    finally { setWriteBusy(false); }
  }

  async function postThreads() {
    if (!text.trim()) { setError('沒有內容可發'); return; }
    setPosting(true); setError(''); setPostResult(null);
    try {
      const r = await fetch('/api/threads/post', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, topicId: selected?.id || '', topicName: selected?.name || '', type: selected?.type || '' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setPostResult({ permalink: d.permalink });
    } catch (e) { setError('發文失敗:' + e.message); }
    finally { setPosting(false); }
  }

  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) {} }

  return (
    <main className="space-y-6">
      <div className="card border-sky-200 bg-sky-50/40">
        <h1 className="text-2xl font-semibold text-stone-900">🧵 內容 / 發文</h1>
        <p className="mt-2 text-sm text-stone-600">
          主題庫（AI 推薦 純文字／長文／圖片 → 確認＋改提示詞 → 存檔）→ 依主題產文 → 發 Threads。成效見「📊 成效分析」。
        </p>
        <div className="mt-3 flex gap-2">
          {[['library', '🗂 主題庫'], ['produce', '✍️ 產文發文']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? 'bg-sky-600 text-white' : 'border border-stone-300 bg-white text-stone-600 hover:bg-stone-50'}`}>{l}</button>
          ))}
          <a href="/analytics" className="ml-auto rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50">📊 成效分析</a>
        </div>
        <p className="mt-2 text-xs">
          {threadsConfigured === null ? '　' : threadsConfigured
            ? <span className="text-emerald-600">✓ Threads 已連接</span>
            : <span className="text-amber-600">⚠ Threads 未連接（可先產文＋複製）</span>}
        </p>
      </div>

      {tab === 'library' && (
        <>
          {/* AI 推薦 */}
          <div className="card space-y-3">
            <h2 className="text-sm font-semibold text-stone-800">1. AI 推薦主題</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label text-xs">型別</label>
                <div className="flex gap-1.5">
                  {TYPES.map((t) => (
                    <button key={t.key} type="button" onClick={() => setBsType(t.key)}
                      className={`rounded-md border px-2.5 py-1 text-xs ${bsType === t.key ? 'border-sky-500 bg-sky-100 text-sky-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label text-xs">幾個</label>
                <select className="input text-sm" value={bsCount} onChange={(e) => setBsCount(Number(e.target.value))}>
                  {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="label text-xs">方向/關鍵字（選填）</label>
                <input className="input text-sm" value={bsKeyword} onChange={(e) => setBsKeyword(e.target.value)} placeholder="例：海芙音波、通羅咖啡廳、術後保養" />
              </div>
              <button type="button" onClick={brainstorm} disabled={bsBusy}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
                {bsBusy ? '發想中…' : '💡 AI 推薦'}
              </button>
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-2 border-t border-stone-200 pt-3">
                {suggestions.map((s, i) => (
                  <div key={i} className={`rounded-lg border p-2 ${s._picked ? 'border-sky-300 bg-sky-50/50' : 'border-stone-200'}`}>
                    <label className="flex items-center gap-2 text-sm font-medium text-stone-800">
                      <input type="checkbox" checked={s._picked} onChange={(e) => setSuggestions((arr) => arr.map((x, j) => j === i ? { ...x, _picked: e.target.checked } : x))} className="size-4 rounded border-stone-300 text-sky-600" />
                      {typeMeta(s.type).emoji} {s.name}
                    </label>
                    <textarea className="input mt-1 min-h-[46px] text-xs" value={s.prompt}
                      onChange={(e) => setSuggestions((arr) => arr.map((x, j) => j === i ? { ...x, prompt: e.target.value } : x))} />
                  </div>
                ))}
                <button type="button" onClick={addPicked} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">
                  ＋ 加入所選到主題庫
                </button>
              </div>
            )}
          </div>

          {/* 主題庫 */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-800">2. 我的主題庫 <span className="font-normal text-stone-500">({topics.length})</span></h2>
              <div className="flex items-center gap-2">
                {saveMsg && <span className="text-xs text-emerald-600">{saveMsg}</span>}
                <button type="button" onClick={saveTopics} disabled={!dirty}
                  className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-40">
                  💾 存檔到雲端{dirty ? ' *' : ''}
                </button>
              </div>
            </div>
            {topics.length === 0 && <p className="text-xs text-stone-400">還沒有主題,先用上方「AI 推薦」加入。</p>}
            <div className="space-y-2">
              {topics.map((t) => (
                <div key={t.id} className="rounded-lg border border-stone-200 p-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[11px] text-stone-600">{typeMeta(t.type).emoji} {typeMeta(t.type).label}</span>
                    <input className="input flex-1 text-sm" value={t.name} onChange={(e) => updateTopic(t.id, { name: e.target.value })} />
                    <button type="button" onClick={() => deleteTopic(t.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">🗑</button>
                  </div>
                  <textarea className="input mt-1 min-h-[46px] text-xs" value={t.prompt} placeholder="提示詞(給產文 AI 的指示)"
                    onChange={(e) => updateTopic(t.id, { prompt: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab === 'produce' && (
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-stone-800">依主題產文</h2>
          {topics.length === 0 ? (
            <p className="text-xs text-stone-400">主題庫是空的,請先到「🗂 主題庫」新增並存檔。</p>
          ) : (
            <>
              <select className="input text-sm" value={selId} onChange={(e) => { setSelId(e.target.value); setText(''); setPostResult(null); }}>
                <option value="">選一個主題…</option>
                {TYPES.map((ty) => {
                  const group = topics.filter((t) => t.type === ty.key && t.enabled !== false);
                  if (!group.length) return null;
                  return (
                    <optgroup key={ty.key} label={`${ty.emoji} ${ty.label}`}>
                      {group.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </optgroup>
                  );
                })}
              </select>
              {selected && <p className="text-[11px] text-stone-500">提示詞:{selected.prompt || '(無)'}</p>}
              <button type="button" onClick={produce} disabled={writeBusy || !selected}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
                {writeBusy ? '產文中…' : '✍️ AI 產文'}
              </button>

              {(writeBusy || text) && (
                <div className="space-y-2 border-t border-stone-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-stone-500">貼文內容(可編輯)</span>
                    <span className={`text-xs ${text.length > 500 ? 'text-red-600' : 'text-stone-400'}`}>{text.length}/500</span>
                  </div>
                  {writeBusy ? <div className="py-6 text-center text-sm text-stone-500">✍️ 產文中…</div> : (
                    <>
                      <textarea className="input min-h-[170px] text-sm leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={postThreads} disabled={posting || !text.trim() || text.length > 500}
                          className="rounded-md bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
                          {posting ? '發佈中…' : '🧵 發到 Threads'}
                        </button>
                        <button type="button" onClick={copy} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">{copied ? '✓ 已複製' : '📋 複製'}</button>
                        <button type="button" onClick={produce} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-50">🔄 重寫</button>
                      </div>
                      {postResult && (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                          ✅ 已發到 Threads！{postResult.permalink && <a href={postResult.permalink} target="_blank" rel="noreferrer" className="font-semibold underline">看貼文 ↗</a>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">❌ {error}</div>}
    </main>
  );
}
