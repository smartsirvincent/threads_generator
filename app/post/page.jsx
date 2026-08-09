'use client';

// 快速發文:主題發想 → AI 產文（含景點介紹）→ 一鍵發到 Threads
import { useEffect, useState } from 'react';
import { medicalClinicProfile, CANONICAL_PROFILE_NAME } from '@/lib/verticals.js';
import { loadCanonicalProfile } from '@/lib/profile-store.js';

const DEFAULT_PROFILE = medicalClinicProfile();

const CATEGORIES = [
  { key: 'treatment', label: '💉 療程介紹', needsTreatment: true },
  { key: 'spot', label: '📍 景點介紹', needsKeyword: true },
  { key: 'promo', label: '🏷 促銷組合', needsTreatment: true },
  { key: 'education', label: '📚 衛教／迷思' },
  { key: 'opinion', label: '💬 閨蜜觀點' },
];

export default function PostPage() {
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const treatments = (profile.products || []).filter((p) => p?.name);
  const clinic = profile.clinic || null;
  const ctx = { brand: profile.brand, brand_persona: profile.brand_persona, audience: profile.audience };

  const [category, setCategory] = useState('treatment');
  const [treatmentIdx, setTreatmentIdx] = useState(0);
  const [keyword, setKeyword] = useState('');

  const [topics, setTopics] = useState([]);
  const [topicsBusy, setTopicsBusy] = useState(false);
  const [topic, setTopic] = useState('');
  const [text, setText] = useState('');
  const [writeBusy, setWriteBusy] = useState(false);

  const [threadsConfigured, setThreadsConfigured] = useState(null);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const cat = CATEGORIES.find((c) => c.key === category) || CATEGORIES[0];
  const treatment = cat.needsTreatment ? treatments[treatmentIdx] : null;

  useEffect(() => {
    (async () => {
      const canon = await loadCanonicalProfile(CANONICAL_PROFILE_NAME);
      if (canon && Array.isArray(canon.products) && canon.products.length > 0) {
        setProfile({ ...DEFAULT_PROFILE, ...canon });
      }
    })();
    (async () => {
      try {
        const r = await fetch('/api/threads/post', { cache: 'no-store' });
        const d = await r.json();
        setThreadsConfigured(!!d.configured);
      } catch (_) { setThreadsConfigured(false); }
    })();
  }, []);

  function reqBody(extra = {}) {
    return {
      category,
      treatmentName: treatment?.name || '',
      treatmentFeatures: treatment?.features || '',
      treatmentPrice: treatment?.promo_offer || '',
      keyword,
      ...ctx, clinic,
      ...extra,
    };
  }

  async function genTopics() {
    setTopicsBusy(true); setError(''); setTopics([]);
    try {
      const r = await fetch('/api/post/topics', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reqBody()),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setTopics(d.topics || []);
    } catch (e) { setError('主題發想失敗:' + e.message); }
    finally { setTopicsBusy(false); }
  }

  async function writePost(t) {
    setTopic(t); setWriteBusy(true); setError(''); setPostResult(null);
    try {
      const r = await fetch('/api/post/write', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(reqBody({ topic: t })),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setText(d.text || '');
    } catch (e) { setError('產文失敗:' + e.message); }
    finally { setWriteBusy(false); }
  }

  async function postToThreads() {
    if (!text.trim()) { setError('沒有內容可發'); return; }
    setPosting(true); setError(''); setPostResult(null);
    try {
      const r = await fetch('/api/threads/post', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setPostResult({ permalink: d.permalink || '', id: d.id });
    } catch (e) { setError('發文失敗:' + e.message); }
    finally { setPosting(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) {}
  }

  return (
    <main className="space-y-6">
      <div className="card border-sky-200 bg-sky-50/40">
        <h1 className="text-2xl font-semibold text-stone-900">🧵 快速發文</h1>
        <p className="mt-2 text-sm text-stone-600">
          選分類 → <strong>AI 想主題</strong> → <strong>AI 產文</strong>（含景點介紹）→ 一鍵發到 Threads。療程 / 診所資訊自動帶入。
        </p>
        <p className="mt-1 text-xs">
          {threadsConfigured === null ? '　'
            : threadsConfigured
              ? <span className="text-emerald-600">✓ Threads 已連接，可直接發文</span>
              : <span className="text-amber-600">⚠ Threads 尚未連接（可先產文＋複製；設定 token 後即可一鍵發）</span>}
        </p>
      </div>

      {/* Step 1: 分類 + 對象 */}
      <div className="card space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">1. 選分類</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" onClick={() => { setCategory(c.key); setTopics([]); setTopic(''); }}
              className={`rounded-full border px-3 py-1 text-sm ${category === c.key ? 'border-sky-500 bg-sky-100 text-sky-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
              {c.label}
            </button>
          ))}
        </div>
        {cat.needsTreatment && (
          <div>
            <label className="label text-xs">選療程</label>
            <select className="input text-sm" value={treatmentIdx} onChange={(e) => setTreatmentIdx(Number(e.target.value))}>
              {treatments.map((t, i) => <option key={t.name + i} value={i}>{t.name}</option>)}
            </select>
          </div>
        )}
        {cat.needsKeyword && (
          <div>
            <label className="label text-xs">景點 / 區域 / 關鍵字（選填，空白讓 AI 自由發想）</label>
            <input className="input text-sm" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="例：通羅咖啡廳、四面佛、恰圖恰週末市集、Icon Siam" />
          </div>
        )}
        <div>
          <button type="button" onClick={genTopics} disabled={topicsBusy}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">
            {topicsBusy ? 'AI 想主題中…' : '💡 AI 想主題'}
          </button>
        </div>
      </div>

      {/* Step 2: 主題 */}
      {topics.length > 0 && (
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-stone-800">2. 選一個主題（點了就自動產文）</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {topics.map((t, i) => (
              <button key={i} type="button" onClick={() => writePost(t)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${topic === t ? 'border-sky-500 bg-sky-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: 產文 + 發佈 */}
      {(writeBusy || text) && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-800">3. 貼文內容（可編輯）</h2>
            <span className={`text-xs ${text.length > 500 ? 'text-red-600' : 'text-stone-400'}`}>{text.length} / 500</span>
          </div>
          {writeBusy ? (
            <div className="py-6 text-center text-sm text-stone-500">✍️ AI 產文中…</div>
          ) : (
            <>
              <textarea className="input min-h-[180px] text-sm leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={postToThreads} disabled={posting || !text.trim() || text.length > 500}
                  className="rounded-md bg-stone-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50">
                  {posting ? '發佈中…' : '🧵 發到 Threads'}
                </button>
                <button type="button" onClick={copy}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50">
                  {copied ? '✓ 已複製' : '📋 複製'}
                </button>
                <button type="button" onClick={() => writePost(topic)} disabled={writeBusy || !topic}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-50">
                  🔄 重寫
                </button>
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

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">❌ {error}</div>}
    </main>
  );
}
