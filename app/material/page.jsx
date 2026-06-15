'use client';

import { useEffect, useState } from 'react';
import { listProfiles, getProfile, getCloudIndex } from '@/lib/profile-store.js';

export default function MaterialPage() {
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState(initialProduct());
  const [brandContext, setBrandContext] = useState({ brand: '', brand_persona: '', audience: '' });
  const [productPhotoUrl, setProductPhotoUrl] = useState(null); // 上傳後拿到的 Cloudinary URL
  const [productPhotoPreview, setProductPhotoPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 新增的廣告元素
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [useLogo, setUseLogo] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const [compositionRefUrl, setCompositionRefUrl] = useState(null);
  const [compositionRefPreview, setCompositionRefPreview] = useState(null);
  const [compRefUploading, setCompRefUploading] = useState(false);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState({
    titles: [], subtitle: '', copy: '', copy_short: '', copy_long: '',
    composition_prompt: '', has_person: false, person_description: '',
  });
  const [picked, setPicked] = useState({
    title: '', subtitle: '', copy: '', copy_short: '', copy_long: '',
  });
  // textMode: 'none' | 'title_sub' | 'short' | 'long'
  const [textMode, setTextMode] = useState('title_sub');
  const [includePerson, setIncludePerson] = useState(false);
  const [personDescription, setPersonDescription] = useState('');
  const [compositionPrompt, setCompositionPrompt] = useState('');
  const [extraPrompt, setExtraPrompt] = useState('');

  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  return (
    <main className="space-y-6">
      <div className="card">
        <h1 className="text-2xl font-semibold text-stone-900">✨ 素材產生器</h1>
        <p className="mt-2 text-sm text-stone-600">
          選產品 → AI 出標題 + 文案 → 一次生成 <strong>1:1 / 9:16 / 1.91:1</strong> 三種比例素材
        </p>
      </div>

      <Stepper current={step} />

      {step === 1 && (
        <Step1Product
          product={product} setProduct={setProduct}
          brandContext={brandContext} setBrandContext={setBrandContext}
          productPhotoUrl={productPhotoUrl} setProductPhotoUrl={setProductPhotoUrl}
          productPhotoPreview={productPhotoPreview} setProductPhotoPreview={setProductPhotoPreview}
          uploading={uploading} setUploading={setUploading}
          logoUrl={logoUrl} setLogoUrl={setLogoUrl}
          logoPreview={logoPreview} setLogoPreview={setLogoPreview}
          useLogo={useLogo} setUseLogo={setUseLogo}
          logoUploading={logoUploading} setLogoUploading={setLogoUploading}
          compositionRefUrl={compositionRefUrl} setCompositionRefUrl={setCompositionRefUrl}
          compositionRefPreview={compositionRefPreview} setCompositionRefPreview={setCompositionRefPreview}
          compRefUploading={compRefUploading} setCompRefUploading={setCompRefUploading}
          error={error} setError={setError}
          onNext={async () => {
            if (!product.name?.trim()) { setError('請至少填寫產品名稱'); return; }
            if (!productPhotoUrl) { setError('請上傳產品照片'); return; }
            setError('');
            setSuggesting(true);
            try {
              const res = await fetch('/api/material/suggest', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ product, ...brandContext, compositionRefUrl }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
              setSuggestions(data);
              setPicked({
                title: data.titles?.[0] || '',
                subtitle: data.subtitle || '',
                copy: data.copy || '',
                copy_short: data.copy_short || '',
                copy_long: data.copy_long || '',
              });
              setCompositionPrompt(data.composition_prompt || '');
              // 若構圖偵測到人物,預設打勾 + 帶入描述
              if (data.has_person && compositionRefUrl) {
                setIncludePerson(true);
                setPersonDescription(data.person_description || '');
              } else {
                setIncludePerson(false);
                setPersonDescription(data.person_description || '');
              }
              setStep(2);
            } catch (e) {
              setError('產生建議失敗:' + e.message);
            } finally {
              setSuggesting(false);
            }
          }}
          loading={suggesting}
        />
      )}

      {step === 2 && (
        <Step2Suggest
          suggestions={suggestions} picked={picked} setPicked={setPicked}
          textMode={textMode} setTextMode={setTextMode}
          includePerson={includePerson} setIncludePerson={setIncludePerson}
          personDescription={personDescription} setPersonDescription={setPersonDescription}
          compositionPrompt={compositionPrompt} setCompositionPrompt={setCompositionPrompt}
          hasCompositionRef={!!compositionRefUrl}
          compositionRefPreview={compositionRefPreview}
          extraPrompt={extraPrompt} setExtraPrompt={setExtraPrompt}
          onBack={() => setStep(1)}
          onRegen={async () => {
            setSuggesting(true);
            try {
              const res = await fetch('/api/material/suggest', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ product, ...brandContext, compositionRefUrl }),
              });
              const data = await res.json();
              if (res.ok) {
                setSuggestions(data);
                setPicked({
                  title: data.titles?.[0] || '',
                  subtitle: data.subtitle || '',
                  copy: data.copy || '',
                  copy_short: data.copy_short || '',
                  copy_long: data.copy_long || '',
                });
                setCompositionPrompt(data.composition_prompt || '');
                if (data.has_person && compositionRefUrl) {
                  setIncludePerson(true);
                  setPersonDescription(data.person_description || '');
                }
              }
            } finally { setSuggesting(false); }
          }}
          regenerating={suggesting}
          onNext={async () => {
            setStep(3);
            setGenerating(true);
            setError('');
            try {
              const res = await fetch('/api/material/generate', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  refUrl: productPhotoUrl,
                  product,
                  title: picked.title,
                  subtitle: picked.subtitle,
                  copy: picked.copy,
                  copyShort: picked.copy_short,
                  copyLong: picked.copy_long,
                  brand: brandContext.brand,
                  brand_persona: brandContext.brand_persona,
                  logoUrl,
                  useLogo,
                  compositionRefUrl,
                  textMode,
                  includePerson,
                  personDescription,
                  compositionPrompt,
                  extraPrompt,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
              setResults(data.results || []);
              setStep(4);
            } catch (e) {
              setError(e.message);
              setStep(2);
            } finally { setGenerating(false); }
          }}
        />
      )}

      {step === 3 && (
        <div className="card text-center">
          {productPhotoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={productPhotoPreview} alt="product" className="mx-auto mb-4 max-h-48 rounded-lg" />
          )}
          <p className="text-lg text-stone-700">🎨 並行生成 3 種比例素材中…</p>
          <p className="mt-1 text-xs text-stone-500">通常 60-90 秒</p>
        </div>
      )}

      {step === 4 && (
        <Step4Results
          results={results}
          productPhotoPreview={productPhotoPreview}
          picked={picked}
          onReset={() => {
            setStep(1);
            setResults([]);
            setSuggestions({ titles: [], subtitle: '', copy: '' });
            setPicked({ title: '', subtitle: '', copy: '' });
            setError('');
          }}
        />
      )}

      {error && step !== 1 && step !== 2 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          ❌ {error}
        </div>
      )}
    </main>
  );
}

function initialProduct() {
  return {
    name: '', features: '', promo_offer: '', image_focus: '',
  };
}

const STEPS = [
  { n: 1, label: '廣告元素' },
  { n: 2, label: 'AI 創意魔法' },
  { n: 3, label: '生成中' },
  { n: 4, label: '完成' },
];

function Stepper({ current }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const active = current === s.n;
        const done = current > s.n;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <div className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
              done ? 'bg-emerald-500 text-white'
                   : active ? 'bg-stone-900 text-white'
                            : 'bg-stone-200 text-stone-500'}`}>
              {done ? '✓' : s.n}
            </div>
            <span className={`text-sm ${active ? 'font-medium text-stone-900' : 'text-stone-500'}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 h-px flex-1 ${done ? 'bg-emerald-500' : 'bg-stone-200'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ============== Step 1: 產品設定 ==============

function Step1Product({
  product, setProduct, brandContext, setBrandContext,
  productPhotoUrl, setProductPhotoUrl, productPhotoPreview, setProductPhotoPreview,
  uploading, setUploading,
  logoUrl, setLogoUrl, logoPreview, setLogoPreview, useLogo, setUseLogo,
  logoUploading, setLogoUploading,
  compositionRefUrl, setCompositionRefUrl, compositionRefPreview, setCompositionRefPreview,
  compRefUploading, setCompRefUploading,
  error, setError,
  onNext, loading,
}) {
  async function uploadFile(file, onSuccess, onProgress) {
    setError('');
    if (!file) return;
    onProgress(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/material/upload-ref', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onSuccess(data.url);
    } catch (e) {
      setError('上傳失敗:' + e.message);
    } finally {
      onProgress(false);
    }
  }
  return (
    <div className="space-y-4">
      <ProductLoader
        onApply={(profile, prod) => {
          if (prod) {
            setProduct({
              name: prod.name || '',
              features: prod.features || '',
              promo_offer: prod.promo_offer || '',
              image_focus: prod.image_focus || '',
            });
            if (Array.isArray(prod.images) && prod.images[0]) {
              setProductPhotoUrl(prod.images[0]);
              setProductPhotoPreview(prod.images[0]);
            }
          }
          if (profile) {
            setBrandContext({
              brand: profile.brand || '',
              brand_persona: profile.brand_persona || '',
              audience: profile.audience || '',
            });
            // 帶入品牌 LOGO 並預設「合成到圖片中」
            if (Array.isArray(profile.brand_logos) && profile.brand_logos[0]) {
              setLogoUrl(profile.brand_logos[0]);
              setLogoPreview(profile.brand_logos[0]);
              setUseLogo(true);
            }
          }
        }}
      />

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-stone-900">產品資訊（手動填寫或從上方載入）</h2>

        <div>
          <label className="label">產品名稱 *</label>
          <input
            className="input"
            value={product.name}
            onChange={(e) => setProduct({ ...product, name: e.target.value })}
            placeholder="例：金湯酸菜烤魚火鍋"
          />
        </div>

        <div>
          <label className="label">產品特色 / 賣點</label>
          <textarea
            className="input min-h-[80px] text-sm"
            value={product.features}
            onChange={(e) => setProduct({ ...product, features: e.target.value })}
            placeholder="一段話描述主要賣點"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">優惠/活動（選填）</label>
            <input
              className="input"
              value={product.promo_offer}
              onChange={(e) => setProduct({ ...product, promo_offer: e.target.value })}
              placeholder="例：買 2 送 1 / 中秋限定 7 折"
            />
          </div>
          <div>
            <label className="label">視覺方向（選填）</label>
            <input
              className="input"
              value={product.image_focus}
              onChange={(e) => setProduct({ ...product, image_focus: e.target.value })}
              placeholder="例：強調熱氣、夜店感、北歐極簡"
            />
          </div>
        </div>

        <div>
          <label className="label">產品照片 * <span className="text-xs font-normal text-stone-500">（上傳一張產品實拍照,AI 會以它為主體生新圖）</span></label>
          <ProductPhotoUploader
            url={productPhotoUrl}
            preview={productPhotoPreview}
            uploading={uploading}
            onPick={async (file) => {
              setError('');
              if (!file) return;
              setUploading(true);
              const reader = new FileReader();
              reader.onload = () => setProductPhotoPreview(reader.result);
              reader.readAsDataURL(file);
              try {
                const form = new FormData();
                form.append('file', file);
                const res = await fetch('/api/material/upload-ref', { method: 'POST', body: form });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
                setProductPhotoUrl(data.url);
              } catch (e) {
                setError('上傳失敗:' + e.message);
              } finally {
                setUploading(false);
              }
            }}
            onClear={() => {
              setProductPhotoUrl(null);
              setProductPhotoPreview(null);
            }}
          />
        </div>
      </div>

      {/* ===== 品牌 LOGO ===== */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-stone-700">🏷 品牌 LOGO（選填）</h3>
          <label className="inline-flex items-center gap-2 text-xs text-stone-600">
            <input
              type="checkbox"
              checked={useLogo}
              onChange={(e) => setUseLogo(e.target.checked)}
              disabled={!logoUrl}
              className="size-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-40"
            />
            合成到圖片中
          </label>
        </div>
        <ImageUploader
          url={logoUrl}
          preview={logoPreview}
          uploading={logoUploading}
          placeholder="上傳品牌 LOGO（PNG 去背最佳）"
          icon="🏷"
          onPick={async (file) => {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setLogoPreview(reader.result);
            reader.readAsDataURL(file);
            await uploadFile(file, (url) => {
              setLogoUrl(url);
              setUseLogo(true);
            }, setLogoUploading);
          }}
          onClear={() => {
            setLogoUrl(null);
            setLogoPreview(null);
            setUseLogo(false);
          }}
        />
        <p className="text-[11px] text-stone-500">
          ⚠ 不上傳 LOGO 或不勾「合成到圖片中」時，AI 嚴禁自行合成任何 LOGO / 品牌標。
        </p>
      </div>

      {/* ===== 構圖參考圖 ===== */}
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-stone-700">🖼 上傳照片模仿構圖（選填）</h3>
        <ImageUploader
          url={compositionRefUrl}
          preview={compositionRefPreview}
          uploading={compRefUploading}
          placeholder="上傳一張你喜歡的構圖參考圖"
          icon="🎨"
          onPick={async (file) => {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setCompositionRefPreview(reader.result);
            reader.readAsDataURL(file);
            await uploadFile(file, setCompositionRefUrl, setCompRefUploading);
          }}
          onClear={() => {
            setCompositionRefUrl(null);
            setCompositionRefPreview(null);
          }}
        />
        <p className="text-[11px] text-stone-500">
          💡 只取構圖 / 鏡頭角度 / 排版佈局，不抄顏色不抄產品。沒上傳就讓 AI 自由發揮。
        </p>
      </div>

      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-stone-700">品牌背景（選填,讓文案更貼合）</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label text-xs">品牌名</label>
            <input className="input" value={brandContext.brand} onChange={(e) => setBrandContext({ ...brandContext, brand: e.target.value })} placeholder="例:87 烤魚" />
          </div>
          <div>
            <label className="label text-xs">品牌人格</label>
            <input className="input" value={brandContext.brand_persona} onChange={(e) => setBrandContext({ ...brandContext, brand_persona: e.target.value })} placeholder="霸氣台味/知性療癒…" />
          </div>
          <div>
            <label className="label text-xs">受眾</label>
            <input className="input" value={brandContext.audience} onChange={(e) => setBrandContext({ ...brandContext, audience: e.target.value })} placeholder="25-40 上班族…" />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onNext} disabled={loading || uploading} className="btn-primary">
          {loading ? '🔮 生成建議中…' : '下一步:AI 出標題+文案 →'}
        </button>
      </div>
    </div>
  );
}

function ProductPhotoUploader(props) {
  return <ImageUploader {...props} icon="📷" placeholder="點擊或拖拉上傳產品照" />;
}

function ImageUploader({ url, preview, uploading, onPick, onClear, icon = '📷', placeholder = '點擊或拖拉上傳' }) {
  if (preview) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="upload" className="size-24 rounded-md object-cover" />
        <div className="flex-1">
          <div className="text-xs text-stone-600">{url ? '✓ 已上傳' : uploading ? '上傳中…' : '本機預覽'}</div>
          {url && <div className="mt-1 break-all text-[10px] text-stone-400">{url.slice(0, 80)}…</div>}
        </div>
        <button type="button" onClick={onClear} className="text-sm text-stone-500 hover:text-red-600">移除</button>
      </div>
    );
  }
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-white py-8 text-center hover:border-emerald-300 hover:bg-emerald-50/30">
      <span className="text-3xl">{icon}</span>
      <span className="text-sm text-stone-600">{placeholder}</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </label>
  );
}

// ============== 產品載入器 ==============

function ProductLoader({ onApply }) {
  const [localProfiles, setLocalProfiles] = useState([]);
  const [cloudProfiles, setCloudProfiles] = useState([]);
  const [selectedProfileName, setSelectedProfileName] = useState('');
  const [loadedProfile, setLoadedProfile] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalProfiles(listProfiles());
    setCloudProfiles(getCloudIndex());
    // 也抓 server cloud list
    (async () => {
      try {
        const res = await fetch('/api/profiles/list', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && Array.isArray(data.profiles)) {
          // merge with localStorage cloud index
          const map = new Map();
          for (const p of getCloudIndex()) map.set(p.publicId, p);
          for (const p of data.profiles) map.set(p.publicId, p);
          setCloudProfiles(Array.from(map.values()));
        }
      } catch (_) {}
    })();
  }, []);

  async function handleLoad() {
    if (!selectedProfileName) return;
    setBusy(true);
    let profileData = null;
    try {
      if (selectedProfileName.startsWith('local:')) {
        profileData = getProfile(selectedProfileName.slice(6));
      } else if (selectedProfileName.startsWith('cloud:')) {
        const publicId = selectedProfileName.slice(6);
        const cp = cloudProfiles.find((p) => p.publicId === publicId);
        if (cp?.url) {
          const r = await fetch(cp.url, { cache: 'no-store' });
          if (r.ok) {
            const wrapper = await r.json();
            profileData = wrapper.profile || wrapper;
          }
        }
      }
      setLoadedProfile(profileData);
    } finally { setBusy(false); }
  }

  if (localProfiles.length === 0 && cloudProfiles.length === 0) {
    return null;
  }

  return (
    <div className="card space-y-3 border-emerald-200 bg-emerald-50/40">
      <h2 className="text-sm font-medium text-emerald-900">📋 從既有品牌設定載入產品（選填）</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedProfileName}
          onChange={(e) => { setSelectedProfileName(e.target.value); setLoadedProfile(null); }}
          className="rounded-md border border-emerald-300 bg-white px-2 py-1 text-sm"
        >
          <option value="">選擇存檔…</option>
          {localProfiles.length > 0 && (
            <optgroup label="💾 本機">
              {localProfiles.map((n) => <option key={`l-${n}`} value={`local:${n}`}>{n}</option>)}
            </optgroup>
          )}
          {cloudProfiles.length > 0 && (
            <optgroup label="☁️ 雲端">
              {cloudProfiles.map((p) => <option key={`c-${p.publicId}`} value={`cloud:${p.publicId}`}>{p.name}</option>)}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          disabled={!selectedProfileName || busy}
          onClick={handleLoad}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? '載入中…' : '載入設定'}
        </button>
      </div>

      {loadedProfile && (
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3">
          <div className="text-xs text-stone-500">
            品牌:<strong className="ml-1 text-stone-800">{loadedProfile.brand || '(未填)'}</strong>
            <span className="ml-2">人格:{loadedProfile.brand_persona?.slice(0, 30) || '(未填)'}…</span>
          </div>
          <div className="text-xs font-medium text-stone-700">點選一個 SKU 帶入:</div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {(loadedProfile.products || []).map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onApply(loadedProfile, p)}
                className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-2 py-1.5 text-left text-xs hover:bg-emerald-50 hover:border-emerald-300"
              >
                {Array.isArray(p.images) && p.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt={p.name} className="size-10 rounded object-cover" />
                )}
                <span className="flex-1 truncate text-stone-800">{p.name}</span>
              </button>
            ))}
          </div>
          {(loadedProfile.products || []).length === 0 && (
            <div className="text-xs text-stone-500">此存檔沒有 SKU</div>
          )}
        </div>
      )}
    </div>
  );
}

// ============== Step 2: 建議 ==============

const TEXT_MODE_OPTIONS = [
  { key: 'none', label: '無任何文字', hint: '純視覺,圖中不出現任何文字' },
  { key: 'title_sub', label: '主標 + 副標', hint: '只有 2 行標題文字' },
  { key: 'short', label: '文案少', hint: '主標 + 副標 + 短版補充 (1-2 行)' },
  { key: 'long', label: '文案多', hint: '主標 + 副標 + 長版文案 (文字較重廣告)' },
];

function Step2Suggest({
  suggestions, picked, setPicked,
  textMode, setTextMode,
  includePerson, setIncludePerson,
  personDescription, setPersonDescription,
  compositionPrompt, setCompositionPrompt,
  hasCompositionRef, compositionRefPreview,
  extraPrompt, setExtraPrompt,
  onBack, onRegen, regenerating, onNext,
}) {
  return (
    <div className="space-y-4">
      {/* ===== 構圖分析 (僅當有上傳構圖照片時顯示) ===== */}
      {hasCompositionRef && (
        <div className="card border-purple-200 bg-purple-50/40 space-y-3">
          <h2 className="text-lg font-semibold text-purple-900">🖼 構圖參考圖分析</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            {compositionRefPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={compositionRefPreview} alt="composition ref" className="size-32 rounded-lg object-cover" />
            )}
            <div className="flex-1 space-y-2">
              <label className="label text-xs">AI 解析後的構圖提示詞 (可改)</label>
              <textarea
                className="input min-h-[100px] text-xs leading-relaxed"
                value={compositionPrompt}
                onChange={(e) => setCompositionPrompt(e.target.value)}
                placeholder="AI 將根據此描述模仿構圖 (鏡頭角度 / 排版 / 光線 / 留白...)"
              />
              <p className="text-[11px] text-purple-700">
                💡 只取構圖,不抄具體內容。可微調英文或加字。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ===== 標題建議 ===== */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">AI 標題建議（選一個或自訂）</h2>
          <button type="button" onClick={onRegen} disabled={regenerating}
            className="text-xs text-stone-500 hover:text-emerald-600 disabled:opacity-50">
            {regenerating ? '重新生成中…' : '🔄 重新生成'}
          </button>
        </div>
        <div className="space-y-2">
          {(suggestions.titles || []).map((t, i) => (
            <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${picked.title === t ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:bg-stone-50'}`}>
              <input
                type="radio"
                name="title"
                checked={picked.title === t}
                onChange={() => setPicked({ ...picked, title: t })}
                className="size-4 border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm text-stone-800">{t}</span>
            </label>
          ))}
        </div>

        <div>
          <label className="label">主標題 (可改)</label>
          <input
            className="input"
            value={picked.title}
            onChange={(e) => setPicked({ ...picked, title: e.target.value })}
          />
        </div>

        <div>
          <label className="label">副標 (可改)</label>
          <input
            className="input"
            value={picked.subtitle}
            onChange={(e) => setPicked({ ...picked, subtitle: e.target.value })}
          />
        </div>
      </div>

      {/* ===== 圖中文案模式 (4 radio) ===== */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-stone-800">📝 圖中文案模式</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {TEXT_MODE_OPTIONS.map((opt) => {
            const active = textMode === opt.key;
            return (
              <label key={opt.key}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${active ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                <input
                  type="radio"
                  name="textMode"
                  checked={active}
                  onChange={() => setTextMode(opt.key)}
                  className="mt-0.5 size-4 border-stone-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-stone-800">{opt.label}</div>
                  <div className="text-[11px] text-stone-500">{opt.hint}</div>
                </div>
              </label>
            );
          })}
        </div>

        {/* short / long 模式才顯示對應 copy 編輯 */}
        {textMode === 'short' && (
          <div>
            <label className="label text-xs">短版圖中文案 (可改)</label>
            <textarea
              className="input min-h-[60px] text-sm"
              value={picked.copy_short}
              onChange={(e) => setPicked({ ...picked, copy_short: e.target.value })}
              placeholder="20-40 字,1-2 行"
            />
          </div>
        )}
        {textMode === 'long' && (
          <div>
            <label className="label text-xs">長版圖中文案 (可改)</label>
            <textarea
              className="input min-h-[100px] text-sm"
              value={picked.copy_long}
              onChange={(e) => setPicked({ ...picked, copy_long: e.target.value })}
              placeholder="60-100 字,可含換行"
            />
          </div>
        )}
      </div>

      {/* ===== 人物 ===== */}
      <div className="card space-y-3">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="includePerson"
            checked={includePerson}
            onChange={(e) => setIncludePerson(e.target.checked)}
            className="mt-1 size-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div className="flex-1">
            <label htmlFor="includePerson" className="cursor-pointer text-sm font-medium text-stone-800">
              👤 圖片中加入人物
            </label>
            {hasCompositionRef && suggestions.has_person && (
              <p className="text-[11px] text-emerald-700">✓ 構圖參考圖中偵測到人物,已預設打勾</p>
            )}
            {hasCompositionRef && !suggestions.has_person && (
              <p className="text-[11px] text-stone-500">構圖參考圖中沒偵測到人物,預設不加</p>
            )}
            {!hasCompositionRef && (
              <p className="text-[11px] text-stone-500">沒上傳構圖參考圖,預設不加人物</p>
            )}
          </div>
        </div>
        {includePerson && (
          <div>
            <label className="label text-xs">人物樣子 (可改)</label>
            <textarea
              className="input min-h-[60px] text-sm"
              value={personDescription}
              onChange={(e) => setPersonDescription(e.target.value)}
              placeholder="例:25 歲女性,休閒風格,雙手捧著產品,自然微笑"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              💡 描述人物性別 / 年齡感 / 穿著 / 姿勢 / 表情
            </p>
          </div>
        )}
      </div>

      {/* ===== 完整貼文文案 (僅在 Step 4 用,圖中不渲染) ===== */}
      <div className="card space-y-2">
        <label className="label">📱 完整貼文文案 (Step 4 可複製,不會渲染到圖中)</label>
        <textarea
          className="input min-h-[100px] text-sm"
          value={picked.copy}
          onChange={(e) => setPicked({ ...picked, copy: e.target.value })}
        />
      </div>

      {/* ===== 額外指示 ===== */}
      <div className="card">
        <label className="label text-xs">額外視覺指示（選填,例:「加上柔光」「換成黃昏色調」）</label>
        <input className="input text-sm" value={extraPrompt} onChange={(e) => setExtraPrompt(e.target.value)} />
      </div>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="btn-secondary">← 上一步</button>
        <button type="button" onClick={onNext} disabled={!picked.title?.trim() && textMode !== 'none'} className="btn-primary">
          下一步:並行生 3 張 →
        </button>
      </div>
    </div>
  );
}

// ============== Step 4: 結果 ==============

const RATIO_INFO = {
  '1:1': { label: 'IG 動態 / FB 貼文', hint: '正方形' },
  '9:16': { label: 'Reels / Stories', hint: '直式 9:16' },
  '1.91:1': { label: 'FB 廣告 / IG 橫向', hint: '橫式 1.91:1' },
};

function Step4Results({ results, productPhotoPreview, picked, onReset }) {
  const [copyStatus, setCopyStatus] = useState('');

  // 組合完整的「貼文文案」: 主標 + 副標 + 文案
  const fullCopy = [
    picked.title,
    picked.subtitle,
    '',
    picked.copy,
  ].filter((s) => s && s.trim()).join('\n');

  async function handleCopy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(label);
      setTimeout(() => setCopyStatus(''), 1500);
    } catch (_) {
      setCopyStatus('複製失敗');
    }
  }

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">🎉 三種比例已產出</h2>
          <button onClick={onReset} className="text-sm text-stone-500 hover:text-stone-900">
            重新開始
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {results.map((r, i) => (
          <ResultCard key={i} result={r} />
        ))}
      </div>

      {/* ===== 完整文案區 ===== */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-800">📝 貼文文案（可直接複製使用）</h3>
          {copyStatus && <span className="text-xs text-emerald-600">{copyStatus}</span>}
        </div>

        <div className="space-y-3 rounded-lg bg-stone-50 p-4">
          {picked.title && (
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide text-stone-400">主標題</div>
                <div className="text-sm font-bold text-stone-900">{picked.title}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(picked.title, '✓ 主標已複製')}
                className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-100"
              >
                複製
              </button>
            </div>
          )}

          {picked.subtitle && (
            <div className="flex items-start justify-between gap-3 border-t border-stone-200 pt-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide text-stone-400">副標</div>
                <div className="text-sm text-stone-800">{picked.subtitle}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(picked.subtitle, '✓ 副標已複製')}
                className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-100"
              >
                複製
              </button>
            </div>
          )}

          {picked.copy && (
            <div className="flex items-start justify-between gap-3 border-t border-stone-200 pt-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wide text-stone-400">完整文案</div>
                <pre className="whitespace-pre-wrap font-sans text-sm text-stone-800">{picked.copy}</pre>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(picked.copy, '✓ 文案已複製')}
                className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-[11px] text-stone-600 hover:bg-stone-100"
              >
                複製
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => handleCopy(fullCopy, '✓ 全部已複製')}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            📋 一次複製全部 (主標 + 副標 + 文案)
          </button>
        </div>
      </div>
    </>
  );
}

function ResultCard({ result }) {
  const info = RATIO_INFO[result.target] || {};
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
      <div className="bg-stone-50 px-3 py-2">
        <div className="text-sm font-semibold text-stone-800">{result.target}</div>
        <div className="text-[11px] text-stone-500">{info.label} · {info.hint}</div>
      </div>
      <div
        className="relative bg-stone-100"
        style={{
          aspectRatio: result.target === '1:1' ? '1/1' : result.target === '9:16' ? '9/16' : '1.91/1',
        }}
      >
        {result.error ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-red-600">
            ⚠ {result.error.slice(0, 80)}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result.url}
            alt={result.target}
            className="size-full object-cover"
            loading="lazy"
          />
        )}
      </div>
      {!result.error && (
        <div className="border-t border-stone-200 bg-white p-2">
          <a href={result.url} target="_blank" rel="noreferrer" download
            className="block rounded-md bg-emerald-600 px-3 py-1.5 text-center text-xs font-medium text-white hover:bg-emerald-700">
            ⬇ 下載
          </a>
        </div>
      )}
    </div>
  );
}
