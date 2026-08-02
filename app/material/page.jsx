'use client';

// 醫美素材 AI 生成 — 批次版
// 療程來自品牌資料庫 (不用重填),多選 → 每個療程各自產一組 (AI 首選標題 + 3 比例)
// LOGO 來自品牌資訊,只勾要不要帶
import { useEffect, useState } from 'react';
import {
  medicalClinicProfile, MATERIAL_TYPES, MEDICAL_SCENES, medicalSceneByKey, CANONICAL_PROFILE_NAME,
} from '@/lib/verticals.js';
import { loadCanonicalProfile } from '@/lib/profile-store.js';

const DEFAULT_PROFILE = medicalClinicProfile();

function firstLogo(profile) {
  const bl = profile?.brand_logos;
  if (Array.isArray(bl)) return bl[0] || '';
  if (typeof bl === 'string') return bl.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || '';
  return '';
}

const TEXT_MODES = [
  { key: 'none', label: '無文字' },
  { key: 'title_sub', label: '名稱＋特點' },
  { key: 'short', label: '名稱＋特點＋價格' },
  { key: 'long', label: '完整文案' },
];

export default function MaterialPage({ heading }) {
  // 預設用內建 BEST FRIEND;若雲端固定槽有存檔(價格/療程有改過)就自動覆蓋 → 跨裝置一致
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const treatments = (profile.products || []).filter((p) => p?.name);

  useEffect(() => {
    (async () => {
      const canon = await loadCanonicalProfile(CANONICAL_PROFILE_NAME);
      if (canon && Array.isArray(canon.products) && canon.products.length > 0) {
        setProfile({ ...DEFAULT_PROFILE, ...canon });
      }
    })();
  }, []);

  const [selected, setSelected] = useState(() => new Set());
  const [materialType, setMaterialType] = useState('brand');
  const [scene, setScene] = useState('auto');
  const [textMode, setTextMode] = useState('short'); // 預設顯示 名稱+特點+價格
  const [includePerson, setIncludePerson] = useState(true);
  const [useLogo, setUseLogo] = useState(true); // 預設一律蓋 LOGO(需品牌資訊有填 LOGO URL)
  const [extraPrompt, setExtraPrompt] = useState('');
  const [ratios, setRatios] = useState(['1:1']); // 預設只生 1:1(避免 Vercel 504)

  const [step, setStep] = useState(1); // 1 設定 / 2 生成中 / 3 結果
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const clinic = profile.clinic || null;
  const brandLogo = firstLogo(profile);

  function toggle(i) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });
  }
  function selectAll() { setSelected(new Set(treatments.map((_, i) => i))); }
  function clearAll() { setSelected(new Set()); }

  // 生單張:submit → 輪詢 poll → finalize。每個 request 都很短,不會 504。
  async function genOneImage(baseBody, ratio) {
    // 1) submit → taskId (~2-3s)
    const sub = await fetch('/api/material/gen-image/submit', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseBody, ratio }),
    });
    const subData = await sub.json();
    if (!sub.ok || !subData.taskId) throw new Error(subData.error || `submit HTTP ${sub.status}`);
    const { taskId, target, cloudinaryAr } = subData;

    // 2) 每 4 秒輪詢一次,最多 ~5 分鐘 (每次 request 都很短)
    let kieUrl = null;
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const pr = await fetch(`/api/gen-image/poll?taskId=${encodeURIComponent(taskId)}`, { cache: 'no-store' });
      const pd = await pr.json();
      if (pd.state === 'success' && pd.kieUrl) { kieUrl = pd.kieUrl; break; }
      if (pd.state === 'fail') throw new Error(pd.error || 'KIE 生成失敗');
    }
    if (!kieUrl) throw new Error('生成逾時(KIE 太久沒回)');

    // 3) finalize:轉存 Cloudinary 永久連結 (~5-10s)
    const fin = await fetch('/api/gen-image/finalize', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kieUrl, brand: profile.brand || 'material' }),
    });
    const fd = await fin.json();
    if (!fin.ok || !fd.url) throw new Error(fd.error || `finalize HTTP ${fin.status}`);
    // 1.91:1 需在 Cloudinary URL 上套裁切 transform
    const url = cloudinaryAr ? fd.url.replace('/image/upload/', `/image/upload/c_fill,g_auto,ar_${cloudinaryAr},w_1080/`) : fd.url;
    return { target, url };
  }

  async function generate() {
    const chosen = [...selected].map((i) => treatments[i]).filter(Boolean);
    if (chosen.length === 0) { setError('請至少勾選一個療程'); return; }
    setError('');
    setResults([]);
    setStep(2);
    const totalUnits = chosen.length * ratios.length;
    let doneUnits = 0;
    setProgress({ done: 0, total: totalUnits, current: chosen[0]?.name || '' });

    const out = [];
    for (let idx = 0; idx < chosen.length; idx++) {
      const t = chosen[idx];
      setProgress({ done: doneUnits, total: totalUnits, current: t.name });
      const product = {
        name: t.name, features: t.features || '',
        promo_offer: t.promo_offer || '', image_focus: t.image_focus || '',
      };
      const entry = { treatment: t.name, title: '', subtitle: '', copy: '', results: [], error: null };
      try {
        // 1) AI 出標題 + 文案 (取首選)
        const sres = await fetch('/api/material/suggest', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            product, brand: profile.brand, brand_persona: profile.brand_persona,
            audience: profile.audience, industry: 'medical_aesthetics', clinic, materialType,
          }),
        });
        const sdata = await sres.json();
        if (!sres.ok) throw new Error(sdata.error || `文案 HTTP ${sres.status}`);
        // 圖上文字以「療程名稱 + 特點 + 價格」為主
        entry.title = t.name;                                   // 療程名稱
        entry.subtitle = sdata.subtitle || t.image_focus || ''; // 特點
        entry.copy = sdata.copy || '';
        const priceLine = (t.promo_offer || '').trim();

        const baseBody = {
          product, title: t.name, subtitle: entry.subtitle,
          copy: sdata.copy || '',
          copyShort: priceLine || sdata.copy_short || '',        // 價格
          copyLong: [entry.subtitle, priceLine].filter(Boolean).join('\n') || sdata.copy_long || '',
          brand: profile.brand, brand_persona: profile.brand_persona,
          logoUrl: useLogo ? brandLogo : null, useLogo: !!(useLogo && brandLogo),
          textMode, includePerson, personDescription: '',
          clinic, materialType, scenePrompt: medicalSceneByKey(scene).en,
        };

        // 2) 每個比例各自 submit→poll→finalize (短請求,免 504)
        for (const ratio of ratios) {
          setProgress({ done: doneUnits, total: totalUnits, current: `${t.name}（${ratio}）` });
          try {
            const img = await genOneImage(baseBody, ratio);
            entry.results.push(img);
          } catch (e) {
            entry.results.push({ target: ratio, error: e.message });
          }
          doneUnits++;
          setProgress({ done: doneUnits, total: totalUnits, current: t.name });
          setResults([...out, entry]);
        }
      } catch (e) {
        entry.error = e.message;
        doneUnits += ratios.length; // 這療程整組跳過
      }
      out.push(entry);
      setResults([...out]);
    }
    setProgress({ done: totalUnits, total: totalUnits, current: '' });
    setStep(3);
  }

  return (
    <main className="space-y-6">
      <div className="card border-rose-200 bg-rose-50/40">
        <h1 className="text-2xl font-semibold text-stone-900">{heading || '💉 醫美素材AI生成'}</h1>
        <p className="mt-2 text-sm text-stone-600">
          從品牌資料庫<strong>勾選療程（可複選）</strong> → 每個療程各生一組。圖片一律以<strong>美麗東方女性</strong>為主，搭配<strong>療程名稱／特點／價格</strong>，不出現產品或儀器。
        </p>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          {/* 療程多選 */}
          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-stone-900">
                選療程 <span className="text-sm font-normal text-stone-500">（已選 {selected.size} / {treatments.length}）</span>
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <button type="button" onClick={selectAll} className="rounded-md border border-stone-300 px-2 py-0.5 text-stone-600 hover:bg-stone-50">全選</button>
                <button type="button" onClick={clearAll} className="rounded-md border border-stone-300 px-2 py-0.5 text-stone-600 hover:bg-stone-50">清除</button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {treatments.map((t, i) => {
                const on = selected.has(i);
                return (
                  <label key={t.name + i}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${on ? 'border-rose-500 bg-rose-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(i)}
                      className="mt-0.5 size-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-800">{t.name}</span>
                      {t.promo_offer && <span className="block truncate text-[11px] text-stone-500">{t.promo_offer}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-stone-400">療程來自「🏷 品牌資訊輸入」的療程資料庫；要改內容請去那裡編輯。</p>
          </div>

          {/* 共用設定 */}
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-stone-800">共用設定（套用到每個療程）</h2>

            <div>
              <div className="label mb-1">素材類型</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.values(MATERIAL_TYPES).map((mt) => {
                  const on = materialType === mt.key;
                  return (
                    <label key={mt.key} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${on ? 'border-rose-500 bg-rose-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                      <input type="radio" name="mt" checked={on} onChange={() => setMaterialType(mt.key)} className="mt-0.5 size-4 border-stone-300 text-rose-600 focus:ring-rose-500" />
                      <span>
                        <span className="block text-sm font-medium text-stone-800">{mt.key === 'promo' ? '🏷 ' : '✨ '}{mt.label}</span>
                        <span className="block text-[11px] text-stone-500">{mt.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="label mb-1">圖片情景</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEDICAL_SCENES.map((s) => {
                  const on = scene === s.key;
                  return (
                    <button key={s.key} type="button" onClick={() => setScene(s.key)}
                      className={`rounded-lg border px-2 py-2 text-xs ${on ? 'border-rose-500 bg-rose-100 font-medium text-rose-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
                      {s.zh}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="label mb-1">圖中文字</div>
                <div className="flex flex-wrap gap-2">
                  {TEXT_MODES.map((m) => {
                    const on = textMode === m.key;
                    return (
                      <button key={m.key} type="button" onClick={() => setTextMode(m.key)}
                        className={`rounded-md border px-2.5 py-1 text-xs ${on ? 'border-rose-500 bg-rose-100 text-rose-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <div className="rounded-md bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                  🖼 圖片一律以<strong>美麗東方女性</strong>為主體，<strong>不出現產品或儀器</strong>，搭配療程名稱／特點／價格文字。
                </div>
                <label className={`flex items-center gap-2 text-sm ${brandLogo ? 'cursor-pointer text-stone-700' : 'text-stone-400'}`}>
                  <input type="checkbox" checked={useLogo && !!brandLogo} disabled={!brandLogo} onChange={(e) => setUseLogo(e.target.checked)} className="size-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500 disabled:opacity-40" />
                  帶入品牌 LOGO
                  {!brandLogo && <span className="text-[11px]">（先到「品牌資訊輸入」填 LOGO URL）</span>}
                </label>
              </div>
            </div>

            <div>
              <div className="label mb-1">輸出比例 <span className="text-xs font-normal text-stone-500">（預設只生 1:1 最穩；多選會變慢、可能逾時）</span></div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: '1:1', label: '1:1 正方（IG/FB）' },
                  { key: '9:16', label: '9:16 直式（Reels）' },
                  { key: '1.91:1', label: '1.91:1 橫式' },
                ].map((r) => {
                  const on = ratios.includes(r.key);
                  return (
                    <button key={r.key} type="button"
                      onClick={() => setRatios((prev) => {
                        const has = prev.includes(r.key);
                        const next = has ? prev.filter((x) => x !== r.key) : [...prev, r.key];
                        return next.length ? next : ['1:1']; // 至少留一個
                      })}
                      className={`rounded-md border px-2.5 py-1 text-xs ${on ? 'border-rose-500 bg-rose-100 text-rose-800' : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'}`}>
                      {on ? '☑ ' : '☐ '}{r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label text-xs">額外視覺指示（選填，套用到全部）</label>
              <input className="input text-sm" value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} placeholder="例：柔光、黃昏色調、留白多一點" />
            </div>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">❌ {error}</div>}

          <div className="flex justify-end">
            <button type="button" onClick={generate} disabled={selected.size === 0}
              className="btn-primary disabled:opacity-50">
              生成 {selected.size} 個療程 × {ratios.length} 比例 →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-3 text-center">
          <p className="text-lg text-stone-700">🎨 批次生成中…</p>
          <p className="text-sm text-stone-500">{progress.done} / {progress.total}　目前：{progress.current}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
            <div className="h-full bg-rose-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-stone-400">每個療程約 60–90 秒，請耐心等候（已完成的會先出現在下方）。</p>
          {results.length > 0 && <ResultList results={results} />}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="card flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">🎉 完成 {results.length} 個療程</h2>
            <button onClick={() => { setStep(1); setResults([]); setError(''); }} className="text-sm text-stone-500 hover:text-stone-900">重新開始</button>
          </div>
          <ResultList results={results} />
        </div>
      )}
    </main>
  );
}

const RATIO_INFO = {
  '1:1': 'IG 動態 / FB',
  '9:16': 'Reels / Stories',
  '1.91:1': 'FB / IG 橫向',
};

function ResultList({ results }) {
  return (
    <div className="space-y-4">
      {results.map((r, i) => (
        <div key={i} className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900">💉 {r.treatment}</h3>
            {r.title && <span className="text-xs text-stone-500">{r.title}</span>}
          </div>
          {r.error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {r.error}</div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(r.results || []).map((img, j) => (
                <div key={j} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <div className="bg-stone-50 px-3 py-1.5 text-[11px] text-stone-500">{img.target} · {RATIO_INFO[img.target] || ''}</div>
                  <div className="bg-stone-100" style={{ aspectRatio: img.target === '1:1' ? '1/1' : img.target === '9:16' ? '9/16' : '1.91/1' }}>
                    {img.error
                      ? <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-red-600">⚠ {String(img.error).slice(0, 60)}</div>
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={img.url} alt={img.target} className="size-full object-cover" loading="lazy" />}
                  </div>
                  {!img.error && (
                    <a href={img.url} target="_blank" rel="noreferrer" download className="block bg-rose-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-rose-700">⬇ 下載</a>
                  )}
                </div>
              ))}
            </div>
          )}
          {r.copy && (
            <details className="text-xs">
              <summary className="cursor-pointer text-stone-500">貼文文案</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-stone-700">{r.copy}</pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
