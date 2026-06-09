'use client';

import { useState } from 'react';

const ALL_PLATFORMS = ['Threads', 'IG', 'FB'];

function buildPayload(input) {
  return {
    brand: input.brand.trim(),
    brand_summary: input.brand_summary.trim(),
    audience: input.audience.trim(),
    brand_persona: input.brand_persona.trim(),
    purchase_url: input.purchase_url.trim(),
    platforms: input.platforms,
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
      }))
      .filter((p) => p.name),
  };
}

export default function Step1Form({ input, setInput, onLoadSample, onSubmit }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setInput((s) => ({ ...s, [field]: value }));
  }

  function togglePlatform(p) {
    setInput((s) => ({
      ...s,
      platforms: s.platforms.includes(p)
        ? s.platforms.filter((x) => x !== p)
        : [...s.platforms, p],
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
      const res = await fetch('/api/recommend', {
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">品牌設定</h2>
          <div className="flex gap-2 text-xs">
            <span className="text-stone-500">載入範例:</span>
            {Object.keys({ '87 烤魚': 1, Infuz: 1, 瑞際: 1 }).map((name) => (
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

        <div>
          <label className="label">品牌總體賣點 * <span className="text-xs font-normal text-stone-500">（用於語錄/觀點/教學等不指向特定 SKU 的主題）</span></label>
          <textarea
            className="input min-h-[80px] text-sm"
            value={input.brand_summary}
            onChange={(e) => update('brand_summary', e.target.value)}
            placeholder="一句話總體賣點，或重要的品牌技術/理念"
          />
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
            <label className="label">品牌人格/口吻 *</label>
            <textarea
              className="input min-h-[80px]"
              value={input.brand_persona}
              onChange={(e) => update('brand_persona', e.target.value)}
              placeholder="霸氣台味 / 知性療癒 / 理性專業"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="label">啟用平台</label>
            <div className="flex gap-3 pt-2">
              {ALL_PLATFORMS.map((p) => (
                <label key={p} className="inline-flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={input.platforms.includes(p)}
                    onChange={() => togglePlatform(p)}
                    className="size-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
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
          <div>
            <label className="label">起始日期</label>
            <input
              type="date"
              className="input"
              value={input.start_date}
              onChange={(e) => update('start_date', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ===== 產品清單 ===== */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-stone-900">
            產品 / SKU <span className="text-sm font-normal text-stone-500">({(input.products || []).length} 個)</span>
          </h2>
          <p className="text-xs text-stone-500">
            每個 SKU 各自有特色 + 圖,「產品介紹」類主題會輪替每個 SKU
          </p>
        </div>

        <div className="space-y-3">
          {(input.products || []).map((p, i) => (
            <ProductCard
              key={i}
              index={i}
              product={p}
              onChange={(patch) => updateProduct(i, patch)}
              onRemove={() => removeProduct(i)}
              canRemove={(input.products || []).length > 1}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addProduct}
          className="w-full rounded-lg border-2 border-dashed border-stone-300 py-3 text-sm text-stone-500 hover:bg-stone-50"
        >
          + 新增產品 / SKU
        </button>
      </div>

      {/* ===== 模式開關 ===== */}
      <div className="card space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-stone-50 px-4 py-3">
          <label className="inline-flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={input.dry_run}
              onChange={(e) => update('dry_run', e.target.checked)}
              className="size-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
            />
            <span>Dry-run 模式（不打 API，用假資料測流程）</span>
          </label>
          <span className="text-xs text-stone-500">
            {input.dry_run ? '✓ 不會花費 API credit' : '會呼叫 Claude API'}
          </span>
        </div>
        <p className="px-4 text-xs text-stone-500">
          💡 文字版輸出後想補 AI 圖片，請到 <a href="/images" className="text-brand-600 underline">「補圖工坊」</a> 上傳 xlsx。
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '🔮 AI 推薦主題中…' : '下一步：AI 推薦主題 →'}
        </button>
      </div>
    </form>
  );
}

function ProductCard({ index, product, onChange, onRemove, canRemove }) {
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

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/40 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-6 items-center justify-center rounded-full bg-stone-200 text-xs font-medium text-stone-600">
          {index + 1}
        </span>
        <input
          className="input flex-1"
          value={product.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="產品 / SKU 名稱（必填）"
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

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">
          <div>
            <label className="label text-xs">產品特色（決定文案 + AI 圖 prompt）</label>
            <textarea
              className="input min-h-[70px] text-xs"
              value={product.features}
              onChange={(e) => onChange({ features: e.target.value })}
              placeholder="這個 SKU 的具體賣點/特色"
            />
          </div>
          <div>
            <label className="label text-xs">產品圖 URL（KIE 圖片生成參考用）</label>
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
            <label className="label text-xs">SKU 專屬購買連結（可選，沒填用品牌預設）</label>
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
