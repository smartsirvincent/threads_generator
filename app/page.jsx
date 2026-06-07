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
    product: '金湯酸菜烤魚火鍋',
    product_features:
      '結合重慶萬州傳統的「醃、烤、燉」三道工藝，選用無刺富含膠原蛋白的芙蓉魚，搭配老酸菜與泡椒熬製的金黃湯底。主打一爐二吃：先吃焦香烤魚，再加湯涮雪花牛肉山等配菜。\n\n11 種湯底（金湯酸菜、青花椒、絕代雙椒、孜然、燈籠泡椒到不辣系），位於新北市新店區中正路 542-2 號。',
    audience: '25-40 歲愛吃辣的上班族、約會情侶、宵夜團體、新北市/捷運可達族群',
    brand_persona:
      '霸氣、挑釁、台味黑色幽默——像會跟你嗆聲但也會關心你的兄弟。文案要有節奏感、語氣硬一點、敢嘴客人但又讓人想點來吃。',
    purchase_url: 'https://lin.ee/782qnzwo',
    product_images:
      'https://i.ibb.co/YBZM5G9N/image.jpg\nhttps://i.ibb.co/BH5s3GVk/3.jpg\nhttps://i.ibb.co/Y4rBjGrd/image.png',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 150,
    start_date: new Date().toISOString().slice(0, 10),
  },
  Infuz: {
    brand: 'Infuz',
    product: '顯瘦寬褲系列',
    product_features:
      '台灣女裝品牌，主打為亞洲女生身材設計的褲款：\n- 後腰鬆緊設計（梨形身材必備）\n- 繭形版型，視覺上下半身輕盈\n- 大腿內側剪接線顯瘦\n- 多版型：方袋錐形彎刀褲、九分男友褲、後腰鬆緊愛心褲、3D 集中顯瘦寬褲',
    audience: '25-40 歲關注顯瘦/身形困擾的女性，多為通勤族與小資族',
    brand_persona:
      '知性、療癒、有同理心的姊姊。短句、換行多，給人「她懂我」的感覺。把問題歸咎於版型而非妳。',
    purchase_url: 'https://www.infuz.com.tw/',
    product_images: 'https://i.ibb.co/gFJsDh73/28039-1.png',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 180,
    start_date: new Date().toISOString().slice(0, 10),
  },
  瑞際: {
    brand: 'LUFTRUM 瑞際',
    product: 'NCX250 智能新風淨化全熱交換機',
    product_features:
      '瑞典智能科技 × 北歐極簡設計，新風+淨化+全熱交換三合一，專為 25-45 坪居家設計。270mm 超薄、UBP 電漿除菌 + H13 HEPA、全熱交換 76%、新風 250m³/h、低噪 32dB。智能面板顯示 PM2.5/CO2/TVOC/室內外溫濕度。',
    audience: '30-50 歲新屋裝潢族、健康家庭、過敏兒父母、室內設計師、地產仲介',
    brand_persona:
      '理性、健康觀察家、有設計師專業感。觀察句、不誇張、用 metaphor 帶出產品。換行多，留白給讀者思考。',
    purchase_url: 'https://reurl.cc/aX1lal',
    product_images: 'https://i.ibb.co/ZzSBwnyb/NCX250.png',
    platforms: ['Threads', 'IG', 'FB'],
    monthly_total: 120,
    start_date: new Date().toISOString().slice(0, 10),
  },
};

const EMPTY_INPUT = {
  brand: '',
  product: '',
  product_features: '',
  audience: '',
  brand_persona: '',
  purchase_url: '',
  product_images: '',
  platforms: ['Threads'],
  monthly_total: 100,
  start_date: new Date().toISOString().slice(0, 10),
  dry_run: false,
  generate_images: true,
};

export default function Home() {
  const [step, setStep] = useState(1);
  const [input, setInput] = useState(EMPTY_INPUT);
  const [themes, setThemes] = useState([]);
  const [result, setResult] = useState(null);

  function loadSample(name) {
    setInput({ ...EMPTY_INPUT, ...SAMPLES[name] });
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
