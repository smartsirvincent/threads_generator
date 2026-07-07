'use client';

import { useState } from 'react';
import Step1Form from '@/components/Step1Form';
import Step2Themes from '@/components/Step2Themes';
import Step3Progress from '@/components/Step3Progress';
import Step4Done from '@/components/Step4Done';
import Stepper from '@/components/Stepper';
import { medicalClinicProfile } from '@/lib/verticals.js';

// 預設就帶入 BEST FRIEND 品牌資料庫 (不用再手動載入)
function defaultInput() {
  const prof = medicalClinicProfile();
  return {
    ...prof,
    platforms: ['Threads', 'IG'],
    monthly_total: 60,
    start_date: '',
    dry_run: false,
    generate_images: true,
    products: (prof.products || []).map((p) => ({ ...p, images: Array.isArray(p.images) ? p.images : [''] })),
  };
}

const SAMPLES = {
  'BEST FRIEND': medicalClinicProfile(),
};

const _UNUSED_SAMPLES = {
  '87 烤魚': {
    brand: '87 霸氣烤魚火鍋',
    brand_summary:
      '重慶萬州風「醃、烤、燉」三道工藝烤魚火鍋，一爐二吃。11 種湯底涵蓋金湯酸菜、青花椒、絕代雙椒、孜然系列等。位於新北市新店區中正路 542-2 號。',
    audience: '25-40 歲愛吃辣的上班族、約會情侶、宵夜團體、新北市/捷運可達族群',
    brand_persona:
      '霸氣、挑釁、台味黑色幽默。視覺要有衝擊感:辣紅、湯金、夜店霓虹、特寫水氣。',
    purchase_url: 'https://lin.ee/782qnzwo',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 60,
    products: [
      { name: '金湯酸菜烤魚火鍋', features: '金黃酸辣湯底,芙蓉魚無刺,先烤後涮', images: ['https://i.ibb.co/YBZM5G9N/image.jpg'], purchase_url: '' },
      { name: '青花椒烤魚火鍋', features: '青花椒清新麻香,不死辣', images: ['https://i.ibb.co/BH5s3GVk/3.jpg'], purchase_url: '' },
      { name: '絕代雙椒烤魚火鍋', features: '青藤椒+大紅袍,獨家底料', images: ['https://i.ibb.co/Y4rBjGrd/image.png'], purchase_url: '' },
      { name: '大汗孜巴烤魚火鍋', features: '濃郁孜然香氣,湯汁吸滿', images: ['https://i.ibb.co/hxBH3bFG/image.jpg'], purchase_url: '' },
    ],
    start_date: '',
  },
  Infuz: {
    brand: 'Infuz',
    brand_summary: '台灣女裝品牌,主打為亞洲女生身材設計的褲款。',
    audience: '25-40 歲關注顯瘦/身形困擾的女性',
    brand_persona: '知性、療癒。視覺要日系冷光、柔和不過曝、有空氣感。',
    purchase_url: 'https://www.infuz.com.tw/',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 72,
    products: [
      { name: '方袋錐形彎刀褲', features: '弧線形外型、修飾假胯', images: ['https://i.ibb.co/gFJsDh73/28039-1.png'], purchase_url: '' },
      { name: '韓系無彈直筒寬褲', features: '褪色感、立體曲線剪裁', images: ['https://i.ibb.co/qYfCRwhF/LINE-ALBUM-24-250122-24.png'], purchase_url: '' },
      { name: '撞色系短版針織毛衣', features: '輕柔親膚、撞色層次', images: ['https://i.ibb.co/14zmpb7/LINE-ALBUM-2025-251121-3.jpg'], purchase_url: '' },
    ],
    start_date: '',
  },
  瑞際: {
    brand: 'LUFTRUM 瑞際',
    brand_summary: '瑞典智能科技 × 北歐極簡設計。空氣淨化解方。',
    audience: '30-50 歲新屋裝潢族、健康家庭',
    brand_persona: '理性、北歐極簡。視覺要白淨、藍綠植、設計師感、留白多。',
    purchase_url: 'https://reurl.cc/aX1lal',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 48,
    products: [
      { name: 'NCX250 智能新風淨化全熱交換機', features: '270mm 超薄,智能面板', images: ['https://i.ibb.co/ZzSBwnyb/NCX250.png'], purchase_url: 'https://reurl.cc/aX1lal' },
      { name: 'C3510 小極淨電漿除菌清淨機', features: 'CADR 350,亞麻灰/粉/藍三色', images: ['https://i.ibb.co/whhgM0Zz/C3510.png'], purchase_url: 'https://reurl.cc/7ER2yk' },
    ],
    start_date: '',
  },
};

const EMPTY_INPUT = {
  brand: '',
  brand_summary: '',
  audience: '',
  brand_persona: '',
  purchase_url: '',
  platforms: ['Threads', 'IG'],
  monthly_total: 60,
  start_date: '', // 起始日期已從 UI 移除,留空白 → xlsx 發文時間欄空白
  products: [
    {
      name: '', features: '', images: [''], purchase_url: '',
      include_in_image_gen: true,
      image_styles: { scene: true, character: true, product: true },
    },
  ],
  image_theme_strategy: 'shared',
  dry_run: false,
  generate_images: true,
};

export default function ImagePlanPage() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState(defaultInput);
  const [themes, setThemes] = useState([]);
  const [result, setResult] = useState(null);

  function loadSample(name) {
    const s = SAMPLES[name];
    if (!s) return;
    setInput({
      ...defaultInput(),
      ...s,
      products: s.products?.map((p) => ({ ...p, images: Array.isArray(p.images) ? p.images : [''] })) || defaultInput().products,
    });
  }

  function reset() {
    setStep(1);
    setInput(defaultInput());
    setThemes([]);
    setResult(null);
  }

  return (
    <main className="space-y-6">
      <Stepper current={step} />

      {step === 1 && (
        <Step1Form
          input={input}
          setInput={setInput}
          onLoadSample={loadSample}
          showImageHint={false}
          showImageStyles={true}
          showThemeStrategy={true}
          loadOnly={true}
          recommendEndpoint="/api/recommend-images"
          submitLabel="下一步：AI 推薦圖片主題 →"
          loadingLabel="🎨 AI 推薦圖片主題中…"
          onSubmit={(themesFromAPI) => {
            setThemes(themesFromAPI);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <Step2Themes
          input={input}
          themes={themes}
          setThemes={setThemes}
          onBack={() => setStep(1)}
          onConfirm={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3Progress
          input={input}
          themes={themes}
          onDone={(res) => { setResult(res); setStep(4); }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <Step4Done input={input} themes={themes} result={result} onReset={reset} />
      )}
    </main>
  );
}
