'use client';

import { useState } from 'react';

const ALL_PLATFORMS = ['Threads', 'IG', 'FB'];

function buildPayload(input) {
  return {
    brand: input.brand.trim(),
    product: input.product.trim(),
    product_features: input.product_features.trim(),
    audience: input.audience.trim(),
    brand_persona: input.brand_persona.trim(),
    purchase_url: input.purchase_url.trim(),
    product_images: input.product_images
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean),
    platforms: input.platforms,
    monthly_total: Number(input.monthly_total) || 100,
    start_date: input.start_date,
    dry_run: input.dry_run,
    generate_images: input.generate_images !== false,
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const required = ['brand', 'product', 'product_features', 'audience', 'brand_persona'];
    for (const k of required) {
      if (!input[k].trim()) {
        setError(`請填寫「${labelOf(k)}」`);
        return;
      }
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
    <form onSubmit={handleSubmit} className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">產品設定</h2>
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
          <label className="label">主打產品 *</label>
          <input
            className="input"
            value={input.product}
            onChange={(e) => update('product', e.target.value)}
            placeholder="例：金湯酸菜烤魚火鍋"
          />
        </div>
      </div>

      <div>
        <label className="label">產品特色 * <span className="text-xs font-normal text-stone-500">（可貼官網介紹/SOP，越詳細越好）</span></label>
        <textarea
          className="input min-h-[120px] font-mono text-xs"
          value={input.product_features}
          onChange={(e) => update('product_features', e.target.value)}
          placeholder="• 核心工藝/技術&#10;• 主打特色&#10;• 規格/規範&#10;• 適用場景"
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">購買連結 / LINE</label>
          <input
            className="input"
            value={input.purchase_url}
            onChange={(e) => update('purchase_url', e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="label">產品圖 URL <span className="text-xs font-normal text-stone-500">（一行一張）</span></label>
          <textarea
            className="input min-h-[60px] font-mono text-xs"
            value={input.product_images}
            onChange={(e) => update('product_images', e.target.value)}
            placeholder="https://i.ibb.co/...&#10;https://..."
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

      <div className="space-y-2 rounded-lg bg-stone-50 px-4 py-3">
        <div className="flex items-center justify-between">
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
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={input.generate_images !== false}
              disabled={input.dry_run}
              onChange={(e) => update('generate_images', e.target.checked)}
              className="size-4 rounded border-stone-300 text-brand-600 focus:ring-brand-500 disabled:opacity-50"
            />
            <span>生成 AI 圖片（KIE GPT Image 2 → Cloudinary）</span>
          </label>
          <span className="text-xs text-stone-500">
            僅對「產品介紹（含圖）」主題生效
          </span>
        </div>
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

function labelOf(k) {
  return {
    brand: '品牌名',
    product: '主打產品',
    product_features: '產品特色',
    audience: '受眾畫像',
    brand_persona: '品牌人格/口吻',
  }[k] || k;
}
