'use client';

import { useState } from 'react';
import Step1Form from '@/components/Step1Form';
import { medicalClinicProfile } from '@/lib/verticals.js';

const EMPTY_INPUT = {
  brand: '',
  brand_summary: '',
  audience: '',
  brand_persona: '',
  purchase_url: '',
  platforms: ['Threads'],
  monthly_total: 100,
  start_date: '',
  industry: 'general',
  clinic: {},
  products: [
    {
      name: '', features: '', images: [''], purchase_url: '',
      include_in_image_gen: true,
      image_styles: { scene: true, character: true, product: true, ecommerce: false },
      promo_offer: '',
      image_focus: '',
    },
  ],
  image_theme_strategy: 'shared',
  brand_logos: '',
  avoid_terms: '',
  dry_run: false,
  generate_images: false,
};

const SAMPLES = {
  'BEST FRIEND': medicalClinicProfile(),
};

// 預設就帶入 BEST FRIEND 範本 (醫美專用)
function defaultInput() {
  const prof = medicalClinicProfile();
  return {
    ...EMPTY_INPUT,
    ...prof,
    platforms: ['Threads'],
    monthly_total: 100,
    start_date: '',
    dry_run: false,
    generate_images: false,
    products: (prof.products || []).map((p) => ({ ...p, images: Array.isArray(p.images) ? p.images : [''] })),
  };
}

export default function BrandPage() {
  const [input, setInput] = useState(defaultInput);

  function loadSample(name) {
    const s = SAMPLES[name];
    if (!s) return;
    setInput({ ...EMPTY_INPUT, ...s, products: s.products?.map((p) => ({ ...p, images: Array.isArray(p.images) ? p.images : [] })) || EMPTY_INPUT.products });
  }

  return (
    <main className="space-y-6">
      <div className="card border-brand-200 bg-brand-50/50">
        <h1 className="flex items-center gap-2 text-2xl font-display font-semibold text-sand-900">
          🏷 品牌資訊輸入
        </h1>
        <p className="mt-2 text-sm text-sand-600">
          這裡專門編輯品牌與 SKU 資料。改完<strong className="text-brand-700">記得按頂部「☁️ 雲端」→「存雲端」</strong>。
          存好後，去文字貼文 / 圖片貼文 / 素材產生時可直接從雲端載入。
        </p>
        <ul className="mt-3 space-y-1 text-xs text-sand-500">
          <li>• <strong>同名覆蓋</strong>：用相同名稱再存一次會直接更新，不會多一筆</li>
          <li>• <strong>備份</strong>：可同時按「💾 本機」+「📥 匯出 JSON」做多層備份</li>
          <li>• <strong>跨裝置</strong>：雲端設定在任何電腦/瀏覽器都看得到</li>
        </ul>
      </div>

      <Step1Form
        input={input}
        setInput={setInput}
        onLoadSample={loadSample}
        showImageHint={false}
        showImageStyles={true}
        showThemeStrategy={true}
        hideSubmit={true}
        onSubmit={() => {}}
      />
    </main>
  );
}
