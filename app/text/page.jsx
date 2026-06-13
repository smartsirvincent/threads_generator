'use client';

import { useState } from 'react';
import Step1Form from '@/components/Step1Form';
import Step2Themes from '@/components/Step2Themes';
import Step3Progress from '@/components/Step3Progress';
import Step4Done from '@/components/Step4Done';
import Stepper from '@/components/Stepper';

const SAMPLES = {
  '87 烤魚': {
    brand: '87 霸氣烤魚火鍋',
    brand_summary:
      '重慶萬州風「醃、烤、燉」三道工藝烤魚火鍋，一爐二吃。11 種湯底涵蓋金湯酸菜、青花椒、絕代雙椒、孜然系列等。位於新北市新店區中正路 542-2 號。',
    audience: '25-40 歲愛吃辣的上班族、約會情侶、宵夜團體、新北市/捷運可達族群',
    brand_persona:
      '霸氣、挑釁、台味黑色幽默——像會跟你嗆聲但也會關心你的兄弟。文案要有節奏感、語氣硬一點、敢嘴客人但又讓人想點來吃。',
    purchase_url: 'https://lin.ee/782qnzwo',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 150,
    products: [
      {
        name: '金湯酸菜烤魚火鍋',
        features:
          '金黃酸辣湯底，老酸菜與泡椒熬製。芙蓉魚無刺富膠原蛋白。先烤後涮、一爐二吃。',
        images: ['https://i.ibb.co/YBZM5G9N/image.jpg'],
        purchase_url: '',
      },
      {
        name: '青花椒烤魚火鍋',
        features:
          '青花椒清新麻香、不死辣。芙蓉魚／江圍魚雙選擇。爽口不膩、適合一群人邊撈邊聊。',
        images: ['https://i.ibb.co/BH5s3GVk/3.jpg'],
        purchase_url: '',
      },
      {
        name: '絕代雙椒烤魚火鍋',
        features:
          '青藤椒 + 大紅袍混合，獨家底料。香麻絕無僅有，花椒控必點。',
        images: ['https://i.ibb.co/Y4rBjGrd/image.png'],
        purchase_url: '',
      },
      {
        name: '大汗孜巴烤魚火鍋',
        features: '濃郁孜然香氣、湯汁吸滿、魚肉滑嫩鮮甜。孜然控必選。',
        images: ['https://i.ibb.co/hxBH3bFG/image.jpg'],
        purchase_url: '',
      },
    ],
    start_date: '',
  },
  Infuz: {
    brand: 'Infuz',
    brand_summary:
      '台灣女裝品牌，為亞洲女生身材設計褲款。核心技術：後腰鬆緊、繭形版型、大腿內側剪接線。解決梨形、蘋果型、H 型、OX 腿、小腹困擾。',
    audience: '25-40 歲關注顯瘦/身形困擾的女性，多為通勤族與小資族',
    brand_persona:
      '知性、療癒、有同理心的姊姊。短句、換行多，給人「她懂我」的感覺。把問題歸咎於版型而非妳。',
    purchase_url: 'https://www.infuz.com.tw/',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 180,
    products: [
      {
        name: '方袋錐形彎刀褲',
        features:
          '弧線形外型輪廓、適度寬鬆不顯腫。方形後口袋帶中性感。修飾假胯、X/O 型腿。',
        images: ['https://i.ibb.co/gFJsDh73/28039-1.png'],
        purchase_url: 'https://goingto.tw/4VVv5',
      },
      {
        name: '韓系無彈直筒寬褲',
        features:
          '低調褪色感、立體曲線剪裁修飾腿型。中磅丹寧布料、挺度好、耐穿。',
        images: ['https://i.ibb.co/qYfCRwhF/LINE-ALBUM-24-250122-24.png'],
        purchase_url: 'https://goingto.tw/UzaiA',
      },
      {
        name: '撞色系短版針織毛衣',
        features:
          '輕柔舒適、撞色層次感。領口/袖口/下襬小花形收邊。短版凸顯腰身不腫胖。',
        images: ['https://i.ibb.co/14zmpb7/LINE-ALBUM-2025-251121-3.jpg'],
        purchase_url: 'https://goingto.tw/CZgUT',
      },
    ],
    start_date: '',
  },
  瑞際: {
    brand: 'LUFTRUM 瑞際',
    brand_summary:
      '瑞典智能科技 × 北歐極簡設計。專為中大型居家／小坪數家庭打造的空氣淨化解方。UBP 電漿除菌 + H13 HEPA 雙重技術。',
    audience: '30-50 歲新屋裝潢族、健康家庭、過敏兒父母、室內設計師、地產仲介',
    brand_persona:
      '理性、健康觀察家、有設計師專業感。觀察句、不誇張、用 metaphor 帶出產品。換行多，留白給讀者思考。',
    purchase_url: 'https://reurl.cc/aX1lal',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 120,
    products: [
      {
        name: 'NCX250 智能新風淨化全熱交換機',
        features:
          '新風+淨化+全熱交換三合一，適 25-45 坪。270mm 超薄、新風 250m³/h、低噪 32dB。智能面板顯示 PM2.5/CO2/TVOC。',
        images: ['https://i.ibb.co/ZzSBwnyb/NCX250.png'],
        purchase_url: 'https://reurl.cc/aX1lal',
      },
      {
        name: 'C3510 小極淨電漿除菌清淨機',
        features:
          'CADR 350、適 8-15 坪、5 重 HEPA H13。UBP 電漿 + 500 萬除菌離子主動破壞 99.9%病原。北歐極簡、亞麻灰/櫻花粉/湖水藍三色。',
        images: ['https://i.ibb.co/whhgM0Zz/C3510.png'],
        purchase_url: 'https://reurl.cc/7ER2yk',
      },
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
  platforms: ['Threads'],
  monthly_total: 100,
  start_date: '',
  products: [
    { name: '', features: '', images: [''], purchase_url: '' },
  ],
  dry_run: false,
  generate_images: false, // 文字流程不生圖,要圖請走 /images
};

export default function Home() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState(EMPTY_INPUT);
  const [themes, setThemes] = useState([]);
  const [result, setResult] = useState(null);

  function loadSample(name) {
    const s = SAMPLES[name];
    setInput({
      ...EMPTY_INPUT,
      ...s,
      // 確保 products 陣列存在
      products: s.products?.map((p) => ({
        ...p,
        images: Array.isArray(p.images) ? p.images : [],
      })) || EMPTY_INPUT.products,
    });
  }

  function reset() {
    setStep(1);
    setInput(EMPTY_INPUT);
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
          onSubmit={async (themesFromAPI) => {
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
          onDone={(res) => {
            setResult(res);
            setStep(4);
          }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && (
        <Step4Done input={input} themes={themes} result={result} onReset={reset} />
      )}
    </main>
  );
}
