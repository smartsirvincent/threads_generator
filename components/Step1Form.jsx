'use client';

import { useEffect, useState } from 'react';
import {
  listProfiles, getProfile, saveProfile, deleteProfile, getLastUsedName,
  getCloudIndex, addToCloudIndex, removeFromCloudIndex, mergeCloudProfiles,
  loadCanonicalProfile,
} from '@/lib/profile-store.js';
import { CANONICAL_PROFILE_NAME } from '@/lib/verticals.js';

const ALL_PLATFORMS = ['Threads', 'IG', 'FB'];

function buildPayload(input) {
  return {
    brand: input.brand.trim(),
    brand_summary: input.brand_summary.trim(),
    audience: input.audience.trim(),
    brand_persona: input.brand_persona.trim(),
    purchase_url: input.purchase_url.trim(),
    platforms: Array.isArray(input.platforms) && input.platforms.length > 0 ? input.platforms : ['Threads'],
    monthly_total: Number(input.monthly_total) || 100,
    start_date: input.start_date,
    dry_run: input.dry_run,
    generate_images: input.generate_images !== false,
    products: (input.products || [])
      .map((p) => ({
        name: (p.name || '').trim(),
        features: (p.features || '').trim(),
        images: (Array.isArray(p.images) ? p.images : [])
          .map((s) => (s || '').trim())
          .filter(Boolean),
        purchase_url: (p.purchase_url || '').trim(),
        include_in_image_gen: p.include_in_image_gen !== false,
        weight: Number(p.weight) > 0 ? Number(p.weight) : 1,
        image_styles: p.image_styles || { scene: true, character: true, product: true, ecommerce: false },
        promo_offer: (p.promo_offer || '').trim(),
        image_focus: (p.image_focus || '').trim(),
      }))
      .filter((p) => p.name),
    brand_logos: (input.brand_logos || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    avoid_terms: (input.avoid_terms || '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    image_theme_strategy: input.image_theme_strategy === 'per_sku' ? 'per_sku' : 'shared',
    industry: 'medical_aesthetics', // 醫美專用
    clinic: input.clinic && typeof input.clinic === 'object' ? input.clinic : {},
  };
}

const CLINIC_FIELDS = [
  { key: 'name_zh', label: '診所中文名', ph: '泰國醫美 Best Friend' },
  { key: 'name', label: '診所英文名', ph: 'Best Friend Clinic' },
  { key: 'location', label: '地點', ph: '泰國曼谷（近 BTS）' },
  { key: 'certifications', label: '認證 / 資質', ph: 'KFDA / CE / FDA 認證儀器、合法執照…', long: true },
  { key: 'doctor_team', label: '醫療團隊', ph: '自有醫師團隊、中文醫療翻譯全程…', long: true },
  { key: 'service', label: '服務', ph: '中文地陪、接送全包、LINE 售後…', long: true },
  { key: 'package', label: '旅遊套餐 / 方案', ph: '變美旅遊二日套餐、5,000 醫美券…', long: true },
  { key: 'line', label: 'LINE / 聯絡', ph: 'LINE 官方帳號或連結（選填）' },
];

export default function Step1Form({
  input,
  setInput,
  onLoadSample,
  onSubmit,
  recommendEndpoint = '/api/recommend',
  submitLabel = '下一步：AI 推薦主題 →',
  loadingLabel = '🔮 AI 推薦主題中…',
  showImageHint = true,
  showImageStyles = false,         // SKU 級別圖片風格 checkbox (僅圖片相關流程)
  showThemeStrategy = false,        // 主題分配策略 radio (shared/per_sku) — 文字+圖片都用
  hideSubmit = false,
  loadOnly = false, // 只能載入,不能存/刪/匯出/匯入 (給 /text /image-plan /material 用)
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [cloudProfiles, setCloudProfiles] = useState([]);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [priceBlob, setPriceBlob] = useState('');
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceMsg, setPriceMsg] = useState('');

  async function applyPrices() {
    const names = (input.products || []).map((p) => (p.name || '').trim()).filter(Boolean);
    if (!priceBlob.trim()) { setPriceMsg('請先貼上價目表文字'); return; }
    if (names.length === 0) { setPriceMsg('沒有療程可對應'); return; }
    setPriceBusy(true); setPriceMsg('');
    try {
      const res = await fetch('/api/material/parse-prices', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rawText: priceBlob, names }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const map = new Map((data.prices || []).map((p) => [String(p.name).trim(), String(p.promo_offer || '').trim()]));
      const filled = names.filter((n) => map.get(n)).length;
      setInput((s) => ({
        ...s,
        products: (s.products || []).map((p) => {
          const v = map.get((p.name || '').trim());
          return v ? { ...p, promo_offer: v } : p;
        }),
      }));
      setPriceMsg(`✓ 已自動填入 ${filled} / ${names.length} 個療程的價格（記得往下按「存雲端」保存）`);
    } catch (e) {
      setPriceMsg('失敗:' + e.message);
    } finally {
      setPriceBusy(false);
    }
  }

  useEffect(() => {
    setProfiles(listProfiles());
    // 單一品牌:雲端只顯示固定槽 (BEST FRIEND),隱藏其他舊專案殘留的存檔,避免誤載入/404
    setCloudProfiles(getCloudIndex().filter((p) => (p.name || '').trim() === CANONICAL_PROFILE_NAME));
    refreshCloudProfiles();
    // 跨裝置:自動載入固定槽的雲端存檔 (若有),覆蓋預設內建範本
    (async () => {
      const canon = await loadCanonicalProfile(CANONICAL_PROFILE_NAME);
      if (canon && Array.isArray(canon.products) && canon.products.length > 0) {
        applyProfile(canon);
      }
    })();
  }, []);

  function refreshProfiles() {
    setProfiles(listProfiles());
  }

  async function refreshCloudProfiles() {
    setCloudError('');
    try {
      const res = await fetch('/api/profiles/list', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        // 只保留固定槽 (BEST FRIEND),隱藏舊專案殘留存檔
        setCloudProfiles(mergeCloudProfiles(data.profiles || []).filter((p) => (p.name || '').trim() === CANONICAL_PROFILE_NAME));
      } else {
        setCloudError(data.error || `HTTP ${res.status}`);
      }
    } catch (e) {
      setCloudError(e.message);
    }
  }

  function handleSaveProfile() {
    const defaultName = input.brand || getLastUsedName() || '我的設定';
    const name = window.prompt('儲存到瀏覽器,名稱:', defaultName)?.trim();
    if (!name) return;
    if (profiles.includes(name) && !window.confirm(`「${name}」已存在，覆蓋嗎？`)) return;
    saveProfile(name, input);
    refreshProfiles();
  }

  function handleLoadProfile(name) {
    if (!name) return;
    const p = getProfile(name);
    if (!p) return;
    applyProfile(p);
  }

  function applyProfile(p) {
    setInput((s) => ({
      ...s,
      ...p,
      dry_run: s.dry_run,
      generate_images: s.generate_images,
      products: Array.isArray(p.products) && p.products.length > 0
        ? p.products
        : s.products,
    }));
  }

  function handleDeleteProfile(name) {
    if (!window.confirm(`刪除「${name}」？此操作無法復原`)) return;
    deleteProfile(name);
    refreshProfiles();
  }

  async function handleSaveCloud() {
    // 單一品牌:一律存到固定槽 (跨裝置一致),不再問名稱
    const name = CANONICAL_PROFILE_NAME;
    setCloudBusy(true);
    setCloudError('');
    try {
      // 先比對「舊價 → 新價」,記錄價格異動(供「更新未發價格」用)
      try {
        const prev = await loadCanonicalProfile(CANONICAL_PROFILE_NAME);
        const oldMap = new Map((prev?.products || []).map((p) => [(p.name || '').trim(), (p.promo_offer || '').trim()]));
        const changes = (input.products || [])
          .map((p) => ({ name: (p.name || '').trim(), from: oldMap.get((p.name || '').trim()) || '', to: (p.promo_offer || '').trim() }))
          .filter((c) => c.from && c.to && c.from !== c.to);
        if (changes.length) {
          await fetch('/api/pricechanges', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'add', changes }) });
        }
      } catch (_) { /* 記錄異動失敗不影響存檔 */ }

      const { dry_run: _dr, generate_images: _gi, ...persistable } = input;
      const res = await fetch('/api/profiles/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, profile: persistable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const entry = { publicId: data.publicId, url: data.url, name, createdAt: new Date().toISOString() };
      addToCloudIndex(entry);
      setCloudProfiles((arr) => [entry, ...arr.filter((p) => p.publicId !== entry.publicId)]);
      setCloudError('✓ 已存雲端(跨裝置)');
      setTimeout(() => setCloudError(''), 2500);
    } catch (e) {
      setCloudError(e.message);
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleLoadCloud(url) {
    if (!url) return;
    setCloudBusy(true);
    setCloudError('');
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} 載入失敗 (可能已刪除)`);
      const data = await res.json();
      if (data?.profile) applyProfile(data.profile);
    } catch (e) {
      setCloudError(e.message);
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleDeleteCloud(publicId, name) {
    if (!window.confirm(`從雲端刪除「${name}」？此操作無法復原`)) return;
    setCloudBusy(true);
    setCloudError('');
    try {
      const res = await fetch('/api/profiles/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // 1. 從 localStorage cloud index 拿掉
      removeFromCloudIndex(publicId);
      // 2. optimistic 從 UI 拿掉
      setCloudProfiles((arr) => arr.filter((p) => p.publicId !== publicId));
    } catch (e) {
      setCloudError(e.message);
    } finally {
      setCloudBusy(false);
    }
  }

  function handleExportJSON() {
    const { dry_run: _dr, generate_images: _gi, ...persistable } = input;
    const json = JSON.stringify({ name: input.brand || 'profile', profile: persistable, savedAt: Date.now() }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (input.brand || 'profile').replace(/[^\w一-龥\-]/g, '_').slice(0, 40);
    a.href = url;
    a.download = `${safeName}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 200);
  }

  function handleImportJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const p = data.profile || data;
        applyProfile(p);
      } catch (err) {
        alert('讀取 JSON 失敗: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // 允許重選同一檔
  }

  function update(field, value) {
    setInput((s) => ({ ...s, [field]: value }));
  }

  // togglePlatform 已移除 (UI 拿掉啟用平台選項,後端預設 ['Threads'])

  function toggleProductImageStyle(i, key) {
    // 預設值: scene/character/product 預設 true,ecommerce 預設 false
    const defaults = { scene: true, character: true, product: true, ecommerce: false };
    setInput((s) => ({
      ...s,
      products: s.products.map((p, idx) => {
        if (idx !== i) return p;
        const current = p.image_styles || defaults;
        const prevVal = current[key] !== undefined ? current[key] : defaults[key];
        return {
          ...p,
          image_styles: { ...defaults, ...current, [key]: !prevVal },
        };
      }),
    }));
  }

  function updateProduct(i, patch) {
    setInput((s) => ({
      ...s,
      products: s.products.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    }));
  }

  function addProduct() {
    setInput((s) => ({
      ...s,
      products: [...(s.products || []), { name: '', features: '', images: [''], purchase_url: '' }],
    }));
  }

  function removeProduct(i) {
    setInput((s) => ({
      ...s,
      products: s.products.filter((_, idx) => idx !== i),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const required = ['brand', 'brand_summary', 'audience', 'brand_persona'];
    for (const k of required) {
      if (!(input[k] || '').trim()) {
        setError(`請填寫「${labelOf(k)}」`);
        return;
      }
    }
    const validProducts = (input.products || []).filter((p) => (p.name || '').trim());
    if (validProducts.length === 0) {
      setError('至少要有一個產品（含名稱）');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(recommendEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildPayload(input)),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      onSubmit(data.themes);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ===== 品牌設定 ===== */}
      <div className="card space-y-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-stone-900">品牌設定</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-stone-500">範例:</span>
              {Object.keys({ 'BEST FRIEND': 1 }).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onLoadSample(name)}
                  className="rounded-md border border-stone-300 px-2 py-0.5 text-stone-600 hover:bg-stone-50"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* 單一品牌:自動載入雲端固定槽 → 不再有「載入」下拉(避免誤選/跳回)。只保留一鍵存雲端。 */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-stone-50 p-3 text-xs">
            {loadOnly ? (
              <span className="text-stone-600">
                ☁️ 已自動載入雲端的品牌資料庫（跨裝置一致）。要改療程 / 價格請去 <a href="/brand" className="font-semibold text-emerald-700 underline">🏷 品牌資訊輸入</a>。
              </span>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveCloud}
                  disabled={cloudBusy}
                  className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {cloudBusy ? '儲存中…' : '☁️ 儲存到雲端（跨裝置）'}
                </button>
                <span className="text-stone-500">改完療程 / 價格後按這裡，所有裝置重整就會同步。</span>
                {cloudError && (
                  <span className={cloudError.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}>{cloudError.slice(0, 60)}</span>
                )}
                <details className="ml-auto">
                  <summary className="cursor-pointer text-stone-400 hover:text-stone-600">JSON 備份</summary>
                  <div className="mt-1 flex gap-1.5">
                    <button type="button" onClick={handleExportJSON} className="rounded-md border border-stone-300 bg-white px-2 py-0.5 text-stone-700 hover:bg-stone-50">📥 匯出</button>
                    <label className="cursor-pointer rounded-md border border-stone-300 bg-white px-2 py-0.5 text-stone-700 hover:bg-stone-50">
                      📤 匯入
                      <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                    </label>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">品牌名 *</label>
            <input
              className="input"
              value={input.brand}
              onChange={(e) => update('brand', e.target.value)}
              placeholder="例：87 霸氣烤魚火鍋"
            />
          </div>
          <div>
            <label className="label">預設購買連結 / LINE</label>
            <input
              className="input"
              value={input.purchase_url}
              onChange={(e) => update('purchase_url', e.target.value)}
              placeholder="https://... (產品沒填時用)"
            />
          </div>
        </div>

        {/* ===== 診所資訊 (醫美專用,恆顯示) ===== */}
        <div className="rounded-lg border border-rose-200 bg-rose-50/30 p-3 space-y-3">
          <div className="text-sm font-semibold text-rose-900">🏥 診所資訊 <span className="text-xs font-normal text-stone-500">（融入文案信任感 + 生圖診間氛圍；不會憑空生出假認證標）</span></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {CLINIC_FIELDS.map((f) => (
              <div key={f.key} className={f.long ? 'md:col-span-2' : ''}>
                <label className="label text-xs">{f.label}</label>
                {f.long ? (
                  <textarea
                    className="input min-h-[54px] text-xs"
                    value={(input.clinic || {})[f.key] || ''}
                    onChange={(e) => update('clinic', { ...(input.clinic || {}), [f.key]: e.target.value })}
                    placeholder={f.ph}
                  />
                ) : (
                  <input
                    className="input text-sm"
                    value={(input.clinic || {})[f.key] || ''}
                    onChange={(e) => update('clinic', { ...(input.clinic || {}), [f.key]: e.target.value })}
                    placeholder={f.ph}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="label">品牌總體賣點 * <span className="text-xs font-normal text-stone-500">（用於語錄/觀點/衛教等不指向特定療程的主題）</span></label>
          <textarea
            className="input min-h-[80px] text-sm"
            value={input.brand_summary}
            onChange={(e) => update('brand_summary', e.target.value)}
            placeholder="一句話總體賣點，或重要的品牌技術/理念"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">
              品牌 LOGO URL <span className="text-xs font-normal text-stone-500">（可選；一行一張；空白則嚴禁 AI 自行合成 LOGO）</span>
            </label>
            <textarea
              className="input min-h-[60px] font-mono text-xs"
              value={input.brand_logos || ''}
              onChange={(e) => update('brand_logos', e.target.value)}
              placeholder="https://...logo.png&#10;https://...logo-white.png"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              {(input.brand_logos || '').trim()
                ? '✓ 已提供 LOGO,AI 生圖時會作為參考'
                : '⚠ 未提供,AI 生圖時會嚴禁出現任何 LOGO / 品牌標字'}
            </p>
          </div>
          <div>
            <label className="label">
              避免在文案/圖片提及 <span className="text-xs font-normal text-stone-500">（一行一條；競品名 / 禁字 / 不想用的形容詞）</span>
            </label>
            <textarea
              className="input min-h-[60px] text-xs"
              value={input.avoid_terms || ''}
              onChange={(e) => update('avoid_terms', e.target.value)}
              placeholder="例：&#10;競品 XX&#10;傳統&#10;最便宜"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">受眾畫像 *</label>
            <textarea
              className="input min-h-[80px]"
              value={input.audience}
              onChange={(e) => update('audience', e.target.value)}
              placeholder="年齡 / 性別 / 痛點 / 地區"
            />
          </div>
          <div>
            <label className="label">品牌人格/口吻 * <span className="text-xs font-normal text-rose-600">（建議用「閨蜜」口吻）</span></label>
            <textarea
              className="input min-h-[80px]"
              value={input.brand_persona}
              onChange={(e) => update('brand_persona', e.target.value)}
              placeholder="像閨蜜跟妳說話：用「妳」稱呼、親暱直接、真心挺妳、幫妳把關、不硬推銷"
            />
          </div>
        </div>

        {showThemeStrategy && (
          <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3">
            <label className="label mb-2">
              療程分配策略 <span className="text-xs font-normal text-stone-500">（影響 AI 推薦主題與貼文如何對應療程）</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {[
                { key: 'shared', label: '🔀 輪用', desc: '一個主題輪替多個療程（視覺多元）' },
                { key: 'per_sku', label: '📌 一療程一篇', desc: '每個療程有專屬主題（主題直接指向該療程）' },
              ].map((s) => (
                <label key={s.key} className="flex flex-1 min-w-[200px] cursor-pointer items-start gap-2 rounded-md border border-stone-200 bg-white p-2 hover:bg-stone-50">
                  <input
                    type="radio"
                    name="image_theme_strategy"
                    checked={(input.image_theme_strategy || 'shared') === s.key}
                    onChange={() => update('image_theme_strategy', s.key)}
                    className="mt-1 size-4 border-stone-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span>
                    <span className="block text-sm font-medium text-stone-800">{s.label}</span>
                    <span className="block text-[11px] text-stone-500">{s.desc}</span>
                  </span>
                </label>
              ))}
            </div>
            {showImageStyles && (
              <p className="mt-2 text-[11px] text-stone-500">
                💡 圖片風格（情境 / 人物）在下方每個療程卡片裡各自設定
              </p>
            )}
          </div>
        )}

        <div>
          <label className="label">每月發文總量</label>
          <input
            type="number"
            className="input"
            value={input.monthly_total}
            onChange={(e) => update('monthly_total', e.target.value)}
            min={20}
            max={500}
          />
        </div>
      </div>

      {/* ===== 產品清單 ===== */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            療程資料庫 <span className="text-sm font-normal text-stone-500">({(input.products || []).length} 個療程)</span>
          </h2>
          <p className="text-xs text-stone-500">
            勾選「納入生成」的療程才會被產文 / 圖片 / 素材使用
          </p>
        </div>

        {/* ===== 批次貼價格 → AI 自動分配到各療程 ===== */}
        <details className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-amber-900">💰 批次貼價格（貼一大串價目表，AI 自動填到各療程）</summary>
          <div className="mt-3 space-y-2">
            <textarea
              className="input min-h-[110px] text-xs"
              value={priceBlob}
              onChange={(e) => setPriceBlob(e.target.value)}
              placeholder={'把整份價目表原文貼進來，例如：\n海芙音波三代 6999/400發\n水光肌 1999/cc 整瓶8cc 13999\n完美電波 4999/100發\n肉毒 咀嚼肌 3500 不限U\n…'}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={applyPrices}
                disabled={priceBusy}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {priceBusy ? 'AI 分配中…' : '🪄 自動分配到各療程'}
              </button>
              {priceMsg && <span className="text-xs text-amber-800">{priceMsg}</span>}
            </div>
            <p className="text-[11px] text-amber-700/80">
              AI 只會依你貼的文字對應價格、不會編造；填完可逐一微調，再按下方「☁️ 存雲端」保存。
            </p>
          </div>
        </details>

        <div className="space-y-3">
          {(input.products || []).map((p, i) => (
            <ProductCard
              key={i}
              index={i}
              product={p}
              onChange={(patch) => updateProduct(i, patch)}
              onRemove={() => removeProduct(i)}
              canRemove={(input.products || []).length > 1}
              showImageGenControls={showImageStyles}
              onToggleStyle={(key) => toggleProductImageStyle(i, key)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addProduct}
          className="w-full rounded-lg border-2 border-dashed border-stone-300 py-3 text-sm text-stone-500 hover:bg-stone-50"
        >
          + 新增療程
        </button>
      </div>

      {showImageHint && (
        <div className="card">
          <p className="text-xs text-stone-500">
            💡 想要 AI 圖片，請從首頁進「🖼️ 圖片貼文」獨立流程。
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {!hideSubmit && (
        <div className="flex justify-end">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? loadingLabel : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

function ProductCard({ index, product, onChange, onRemove, canRemove, showImageGenControls = false, onToggleStyle }) {
  const [expanded, setExpanded] = useState(!product.features);

  function updateImage(i, value) {
    const next = [...(product.images || [])];
    next[i] = value;
    onChange({ images: next });
  }
  function addImage() {
    onChange({ images: [...(product.images || []), ''] });
  }
  function removeImage(i) {
    onChange({ images: (product.images || []).filter((_, idx) => idx !== i) });
  }

  const styles = product.image_styles || { scene: true, character: true, product: false, ecommerce: false };

  const enabled = product.include_in_image_gen !== false;
  return (
    <div className={`rounded-xl border p-4 ${
      !enabled ? 'border-stone-300 bg-stone-100/60 opacity-70' : 'border-stone-200 bg-stone-50/40'
    }`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-6 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600">
          {index + 1}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-stone-600" title="勾選才會被產文/圖片/素材使用">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onChange({ include_in_image_gen: e.target.checked })}
            className="size-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
          />
          納入生成
        </label>
        <input
          className="input min-w-[140px] flex-1"
          value={product.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="療程名稱（必填）"
        />
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
        >
          {expanded ? '收合' : '展開'}
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            title="刪除"
          >
            ✕
          </button>
        )}
      </div>

      {showImageGenControls && product.include_in_image_gen !== false && (
        <div className="mt-3 space-y-3 border-t border-stone-200 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-stone-600">可接受的圖片風格:</span>
            {[
              { key: 'scene', label: '🌆 情境' },
              { key: 'character', label: '🧍 人物' },
            ].map((s) => (
              <label key={s.key} className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-stone-700 hover:bg-stone-50">
                <input
                  type="checkbox"
                  checked={styles[s.key] !== false}
                  onChange={() => onToggleStyle?.(s.key)}
                  className="size-3.5 rounded border-stone-300 text-purple-600 focus:ring-purple-500"
                />
                {s.label}
              </label>
            ))}
          </div>
          <div>
            <label className="label text-xs">價格 / 優惠 <span className="font-normal text-stone-500">（例：「6,999／400 發」「每人 5,000 醫美券直接抵」；也可用上方「批次貼價格」自動填）</span></label>
            <textarea
              className="input min-h-[50px] text-xs"
              value={product.promo_offer || ''}
              onChange={(e) => onChange({ promo_offer: e.target.value })}
              placeholder="這個療程的價格/優惠文字"
            />
          </div>
          <div>
            <label className="label text-xs">希望強化的圖片生成方向 <span className="font-normal text-stone-500">（選填，例：「水光肌特寫」「緊緻輪廓」「溫暖診間」）</span></label>
            <textarea
              className="input min-h-[50px] text-xs"
              value={product.image_focus || ''}
              onChange={(e) => onChange({ image_focus: e.target.value })}
              placeholder="這個療程的視覺重點/想強化的元素"
            />
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">
          <div>
            <label className="label text-xs">療程特色 / 效果（決定文案 + AI 圖 prompt）</label>
            <textarea
              className="input min-h-[70px] text-xs"
              value={product.features}
              onChange={(e) => onChange({ features: e.target.value })}
              placeholder="這個療程的具體效果/適應症/賣點"
            />
          </div>
          <div>
            <label className="label text-xs">療程參考圖 URL（AI 生圖參考用，選填）</label>
            <div className="space-y-1.5">
              {(product.images || ['']).map((img, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="input flex-1 font-mono text-xs"
                    value={img}
                    onChange={(e) => updateImage(i, e.target.value)}
                    placeholder="https://i.ibb.co/..."
                  />
                  {(product.images || []).length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100"
                      title="移除"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addImage}
                className="text-xs text-brand-600 hover:underline"
              >
                + 加圖片
              </button>
            </div>
          </div>
          <div>
            <label className="label text-xs">療程專屬連結 / LINE（可選，沒填用品牌預設）</label>
            <input
              className="input text-xs"
              value={product.purchase_url}
              onChange={(e) => onChange({ purchase_url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function labelOf(k) {
  return {
    brand: '品牌名',
    brand_summary: '品牌總體賣點',
    audience: '受眾畫像',
    brand_persona: '品牌人格/口吻',
  }[k] || k;
}
