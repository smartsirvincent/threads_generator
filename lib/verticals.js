// 產業別 (vertical) 設定
// general       = 原本的餐飲 / 電商 / 一般產品邏輯 (預設,不動)
// medical_aesthetics = 醫美 / 診所 (療程為主體,幾乎沒有實體包裝,視覺走膚況+診所信任感)

export const INDUSTRIES = {
  general: { key: 'general', label: '一般 / 餐飲 / 電商' },
  medical_aesthetics: { key: 'medical_aesthetics', label: '醫美 / 診所' },
};

export function isMedical(industry) {
  return industry === 'medical_aesthetics';
}

// 單一品牌 → 固定一個雲端存檔槽,所有流程/裝置都讀同一份 (跨裝置一致)
export const CANONICAL_PROFILE_NAME = '泰國醫美 Best Friend';

// ------------------------------------------------------------------
// 醫美視覺基調
// 依「泰國醫美 Best Friend」的品牌調性 (取自客戶資料):
//   「不是壓迫感的精品診所。也不是冷冰冰的醫院。」→ 溫暖、可信、療癒、旅遊感。
// 這段會加進生圖 prompt,取代餐飲那套「熱氣/霸氣/夜店感」。
// ------------------------------------------------------------------
export const MEDICAL_AESTHETIC_STYLE = [
  'MEDICAL-AESTHETICS BEAUTY DIRECTION: elegant, clean, aspirational medical-beauty aesthetic that feels warm and trustworthy — NOT cold clinical-sterile, NOT intimidating ultra-luxury. Think premium-but-approachable skin clinic crossed with a Bangkok wellness-travel editorial.',
  'Skin & glow: luminous, dewy, healthy "glass skin" (水光肌) with natural radiance, smooth even complexion, soft highlight on cheekbones; natural, believable, never over-retouched plastic look.',
  'Palette: soft warm neutrals — cream, beige, nude, warm white, gentle blush pink, champagne-gold accents; airy and bright, high-key soft lighting with gentle shadows.',
  'Environment (when a setting is shown): minimalist modern clinic / spa with warm wood, marble, soft diffused daylight, fresh flowers or greenery, cozy inviting seating — welcoming like a good friend\'s place, not a hospital.',
  'Mood: calm, confident, self-care, gentle luxury, cared-for and safe.',
  'Photography: shallow depth of field, soft focus background, natural window light, editorial beauty-magazine framing, generous negative space for clean typography.',
  'COMPLIANCE (medical-ad safety): do NOT bake exaggerated or guaranteed-result claims into the visual; do NOT show scary needles / blood / surgery as the hero image; do NOT build explicit before/after grids implying a medical outcome; keep everything aspirational, tasteful and honest.',
].join(' ');

// 醫美預設人物 (大多數療程的自然主體就是一位膚況透亮的亞洲女性)
export const MEDICAL_DEFAULT_PERSON =
  '一位 28-42 歲的東亞女性,五官自然、膚質透亮飽水有光澤,神情自信放鬆、親切,淡妝裸妝感,不誇張、不塑膠感,像剛做完保養後氣色很好的樣子';

// ------------------------------------------------------------------
// 醫美素材類型:品牌形象型 (預設,editorial) vs 促銷型 (電商導購)
// ------------------------------------------------------------------
export const MATERIAL_TYPES = {
  brand: { key: 'brand', label: '品牌形象型', hint: '質感 editorial,水光肌 × 溫暖診間,重氛圍不重促銷' },
  promo: { key: 'promo', label: '促銷型', hint: '電商導購,價格/優惠/名額/醫美券+CTA,轉單導向' },
};

// 促銷型視覺基調 (加在生圖 prompt,讓版型更像電商促銷圖,但仍守醫美合規)
export const MEDICAL_PROMO_STYLE = [
  'PROMO / DIRECT-RESPONSE LAYOUT: high-conversion e-commerce beauty-ad style. Bold clear typographic hierarchy, an eye-catching price / offer / limited-slots callout treated as a clean design element (price pill, ribbon or badge), and an obvious call-to-action feel.',
  'Keep it premium and tasteful (still soft warm medical-beauty palette, still real glowing skin) — punchy but NOT cheap, cluttered or garish.',
  'Only render price/offer text if it is included in the allowed on-image text list; never invent numbers.',
  'COMPLIANCE stays: no guaranteed-result or medical-cure claims, no scary needles/blood, no fake before/after outcome grids.',
].join(' ');

// ------------------------------------------------------------------
// 醫美情景 (scenes) —— 生圖時可選,注入構圖/場景描述
// zh = 給人看的中文標籤;en = 給生圖 AI 的英文場景描述
// ------------------------------------------------------------------
export const MEDICAL_SCENES = [
  { key: 'auto', zh: '自動（AI 自由發揮）', en: '' },
  {
    key: 'glow_closeup', zh: '水光肌臉部特寫',
    en: 'Extreme beauty close-up of an East-Asian woman\'s face showing luminous, dewy "glass skin" with natural texture; soft natural window light, shallow depth of field, cream and beige tones, minimal clean background, generous negative space.',
  },
  {
    key: 'clinic_consult', zh: '溫暖診間諮詢',
    en: 'Warm modern skin-clinic consultation corner: a friendly doctor / consultant gently talking with a relaxed female client, cozy wood and marble, fresh flowers, soft diffused daylight, trustworthy and cared-for mood — welcoming, not hospital-like.',
  },
  {
    key: 'bangkok_travel', zh: '曼谷旅遊變美',
    en: 'Elegant Asian woman enjoying a bright, chic Bangkok lifestyle moment (stylish cafe / boutique hotel / warm city light), radiant confident skin, travel-meets-beauty editorial vibe, warm golden sunlight.',
  },
  {
    key: 'besties', zh: '閨蜜同行',
    en: 'Two stylish female friends together, happy and confident with beautiful healthy glowing skin, warm bright airy setting, candid friendship mood, natural and believable.',
  },
  {
    key: 'after_glow', zh: '術後好氣色日常',
    en: 'A woman with a fresh, radiant, natural everyday look, subtle makeup, healthy lifted facial contour and even luminous skin, soft home or office light — a believable "great skin day" after treatment.',
  },
  {
    key: 'clinic_lounge', zh: '溫暖診間休憩',
    en: 'A calm, elegant woman relaxing in a warm, tasteful modern skin-clinic lounge, soft clinical-luxury lighting, cozy and cared-for feeling. NO devices, machines or equipment shown — just the woman and a soft inviting interior.',
  },
];

export function medicalSceneByKey(key) {
  return MEDICAL_SCENES.find((s) => s.key === key) || MEDICAL_SCENES[0];
}

// ------------------------------------------------------------------
// 「泰國醫美 Best Friend」現成 profile (可一鍵載入)
// 產品/價格全部來自客戶《泰國醫美 BestFriend.xlsx》「醫美產品資訊」分頁。
// ------------------------------------------------------------------
export const MEDICAL_CLINIC = {
  name: 'Best Friend Clinic',
  name_zh: '泰國醫美 Best Friend',
  location: '泰國曼谷（近 BTS，鄰素坤逸 / 席隆 / 通羅商圈）',
  certifications: 'KFDA、CE、美國 FDA 認證儀器與正版藥劑；實體店面、合法執照、合規稅務、Google 評論公開',
  doctor_team: '自有經驗豐富醫師團隊與自有儀器（非租借快閃）；醫師有底薪、不靠抽成，不推銷；受過醫療詞彙訓練的中文翻譯全程逐句翻譯',
  service: '中文地陪全程帶路、機場與診所接送全包、LINE 售後諮詢（回台後仍可問）',
  package:
    '「變美旅遊」二日套餐：第一天逛曼谷、第二天到 Best Friend Clinic 做醫美；含中文地陪＋全程接送＋每人 THB 5,000 醫美券（現金直接抵、不限療程、不需湊額度）。2–3 人 THB 8,399／人起，4–9 人 THB 6,299／人起（機票飯店自理）。',
  line: '',
  contact_url: '',
};

// weight = 發文比重 (1-5,越高在輪用時出現越多);皮秒為「拉客用、發文比例低」故給 1
export const MEDICAL_PRODUCTS = [
  // ===== 促銷組合 =====
  {
    name: '超完美電波（官方預訂價）',
    features: '官方賴預訂專屬價。完美電波 Oligio 多頻多探頭分層拉提、即時阻抗監測，全臉緊緻、下顎線清晰。可依需求選發數，發數越多範圍越廣、效果越明顯。',
    promo_offer: '300發 16,900｜600發 32,900｜900發 44,900｜1,200發 55,900',
    image_focus: '緊緻拉提、清晰下顎線、放鬆舒適的療程氛圍',
    images: [''],
  },
  {
    name: '超完美電波＋海芙音波三代（雙拉提組合）',
    features: '電波(真皮層膠原)＋海芙音波(SMAS 筋膜層)雙管齊下，緊緻與輪廓一次到位、拉提更全面。份量足的方案可跟閨蜜一起分。',
    promo_offer: '電波200發+海芙300發 12,990｜電波300發+海芙400發 18,990｜電波600發+海芙800發 35,990(可跟閨蜜分)｜電波900發+海芙1,100發 54,990(可跟閨蜜分)',
    image_focus: '全臉緊緻上提、清晰輪廓、閨蜜同行',
    images: [''],
  },
  {
    name: '超明星組合',
    features: '一次集合多項精選針劑＋雷射＋面膜的全臉煥膚保養組合，補水、澎潤、透亮、緊緻一次到位。',
    promo_offer: '29,990（含 Vitaran 2cc、Lilie M 5cc、Aqua Luna 1cc、香奈兒 3cc、喬雅露 3cc、Booster White Skin 2cc、皮秒雷射 1 次、膠原蛋白面膜 1 次）',
    image_focus: '全臉水光透亮、澎潤飽滿、明星級好膚況',
    images: [''],
  },

  // ===== 音波 / 拉提 =====
  {
    name: '海芙音波三代 HIFU',
    features: '高強度聚焦超音波，能量精準聚焦 SMAS 筋膜層，1.5/3.0/4.5mm 立體熱凝結點促進膠原新生重組，從根本改善鬆弛下垂、下顎線模糊、雙下巴、眉眼下垂。效果可維持 1–1.5 年。',
    promo_offer: '6,999／400 發',
    image_focus: '緊實上提的臉部輪廓、清晰下顎線',
    images: [''],
  },
  {
    name: '美國極限音波 Ultherapy prime',
    features: '美音二代／超生刀。聚焦超音波打到 SMAS 筋膜層產生 60–70°C 熱凝結點，刺激膠原新生＋組織收縮，不開刀就緊實。美國 FDA 核准、有即時影像，適合 30–50 歲開始鬆弛者。',
    promo_offer: '200條 15,999｜400條 29,999｜600條 39,999',
    image_focus: '深層拉提後的緊實輪廓、清晰下顎與頸部線條',
    images: [''],
  },

  // ===== 針劑 / 填充 / 再生 =====
  {
    name: '喬雅露 Juvelook',
    features: '韓國正宗 Juvelook，聚雙旋乳酸(PDLLA)＋玻尿酸(HA)，真皮層小分子組織增生劑，一次達成緊緻、澎潤、撫紋、改善痘疤並提升膚況。通過 KFDA 與 CE 認可。',
    promo_offer: '1,999／cc；整瓶 8cc 14,999',
    image_focus: '澎潤緊緻的膚質、飽滿有彈性、細緻毛孔',
    images: [''],
  },
  {
    name: '麗珠蘭',
    features: '經典再生針劑，補充肌膚流失的養分與支撐力，改善細紋、暗沉與緊緻度，讓膚質由內而外變好。',
    promo_offer: '9,999／2cc',
    image_focus: '緊緻透亮的膚質、由內而外的年輕感',
    images: [''],
  },
  {
    name: '聚光針 Skinvive',
    features: '注射式保濕微滴，補水撫紋、提升膚質光澤與彈性，打造由內而外的水光肌，自然不僵硬。',
    promo_offer: '12,999／cc；19,999／2cc',
    image_focus: '透亮飽水的水光肌、自然光澤',
    images: [''],
  },
  {
    name: '逆時針 Profilo',
    features: '以刺激膠原蛋白增生為主的再生療程，讓皮膚長回支撐力、線條自然不僵硬。改善法令紋、木偶紋、淚溝、眼下凹陷、下巴鬆弛、毛孔與暗沉，效果漸進、維持力佳。',
    promo_offer: '16,999／一支 2cc',
    image_focus: '自然緊緻的臉部線條、柔和輪廓',
    images: [''],
  },
  {
    name: '童顏針 Sculptra',
    features: '聚左旋乳酸(PLLA)，刺激自體膠原大量新生，漸進式改善大範圍凹陷與鬆弛(太陽穴、蘋果肌、法令紋、臉頰)，效果自然持久、由內而外變飽滿年輕。',
    promo_offer: '23,000／一瓶 10cc',
    image_focus: '飽滿澎潤的臉頰、自然年輕的立體輪廓',
    images: [''],
  },
  {
    name: '生膠原蛋白 Collaju',
    features: '韓國再生療程，智慧生物聚合物精準活化纖維母細胞，大量持續新生自體膠原蛋白、彈力纖維與玻尿酸。即時支撐＋長期再生(約 12 個月)，同步改善凹陷與輪廓鬆弛，維持可達 18–24 個月。',
    promo_offer: '15,999／cc',
    image_focus: '飽滿緊緻、由內而外的膚質光澤',
    images: [''],
  },
  {
    name: '保柔堤 Belotero',
    features: '柔軟細緻的玻尿酸，與組織融合度高，擅長填補細紋、淚溝、唇部與淺層線條，效果自然不腫脹。',
    promo_offer: '12,999／cc',
    image_focus: '平滑細紋、自然澎潤的膚況',
    images: [''],
  },
  {
    name: '玻尿酸（韓國／瑞典／美國）',
    features: '依部位與需求選擇不同產地與劑型，用於淚溝、法令紋、蘋果肌、下巴、唇部填充與塑形，打完當下就有感、效果自然。療程後兩週不建議三溫暖、蒸氣、溫泉。',
    promo_offer: '韓國 4,999／cc｜瑞典 12,999／cc｜美國 14,999／cc',
    image_focus: '精緻立體的五官比例、自然澎潤的唇與下巴',
    images: [''],
  },
  {
    name: '消脂針',
    features: '注射於局部脂肪堆積處，分解代謝多餘脂肪，改善雙下巴、嬰兒肥與小範圍局部曲線，雕塑輪廓。',
    promo_offer: '7,999／一瓶 35cc',
    image_focus: '清爽的下顎與臉部線條、俐落輪廓',
    images: [''],
  },
  {
    name: '肉毒',
    features: '放鬆過度活躍的肌肉，撫平動態紋(抬頭紋、皺眉紋、魚尾紋)，也能瘦小臉、修飾國字臉、調整下顎線、緩解咬肌過緊。效果數天內顯現、幾乎無恢復期，很適合旅遊期間做。',
    promo_offer: '咀嚼肌 3,500 不限 U；額頭／眼尾／眉間 3,500 不限 U',
    image_focus: '柔和自然的表情、乾淨俐落的臉部線條、精神好的氣色',
    images: [''],
  },
  {
    name: '德國天使肉毒',
    features: '不含複合性蛋白質，分子小、純度高，有效降低產生肉毒抗藥性的風險，適合施打過其他廠牌、可能已產生抗體而效果不彰的個案。',
    promo_offer: '包瓶 100U 特惠 11,111',
    image_focus: '高純度質感、乾淨俐落的臉部線條、放鬆自然的表情',
    images: [''],
  },

  // ===== 雷射 / 膚質 =====
  {
    name: '水光肌組合',
    features: '由內而外綻放自然光澤的膚況——飽水透亮、有光澤、沒有黯沉與細紋。專門藥劑組合，做完就有水光肌。適合作息不規律、長時間待冷氣房、肌膚乾燥粗糙的現代人。',
    promo_offer: '1,999／cc；整瓶 8cc 特惠 13,999',
    image_focus: '透亮飽水的水光肌特寫、臉部自然光澤',
    images: [''],
  },
  {
    name: '皮秒雷射',
    features: '一兆分之一秒釋放能量的高科技雷射，把黑色素震碎得更細、加速代謝、恢復輕鬆。術後多半只有輕微泛紅很快退，2–3 小時可上妝，幾乎不影響上班上課。',
    promo_offer: '單次 999',
    image_focus: '乾淨透亮的膚質、淡斑後的均勻膚色',
    images: [''],
  },
  {
    name: '除毛雷射',
    features: '溫和有效的雷射除毛，抑制毛囊、減少毛髮生長，肌膚更光滑乾淨。可依部位選擇，適合怕熱怕悶的季節長期保養。',
    promo_offer: '腋下 單次 299｜小腿／手臂 單次 999｜私密部 單次 1,999',
    image_focus: '光滑乾淨的肌膚、清爽自然',
    images: [''],
  },
];

// 一鍵載入用的完整 profile
export function medicalClinicProfile() {
  return {
    industry: 'medical_aesthetics',
    brand: MEDICAL_CLINIC.name_zh,
    brand_summary:
      '曼谷合法實體醫美診所 Best Friend Clinic，主打「像朋友一樣」的跨國醫美體驗：中文地陪＋中文醫療翻譯全程陪同、費用透明不硬推、正版認證儀器與藥劑。搭配「變美旅遊」二日套餐，讓台灣客人在曼谷旅遊順便安心變美。',
    audience:
      '20–60 歲、以台灣女性為主（也接男性／情侶／閨蜜／母女檔）；想趁曼谷旅遊順便做醫美、英文或泰文不通、預算有限又希望被好好對待、討厭被推銷的人。',
    brand_persona:
      '像「閨蜜」在跟妳說話：用「妳」稱呼、親暱直接、真心挺妳。像會陪妳去、幫妳把關的好姐妹——會說真話、提醒妳別踩雷、不讓妳花冤枉錢、絕不硬推銷。短句、口語、溫暖有同理心，把妳當「人」不是業績。不喊「最便宜/保證見效」，講的是「終於有人把妳當自己人」的安心感。',
    purchase_url: '',
    industry_extra: {
      clinic: { ...MEDICAL_CLINIC },
    },
    clinic: { ...MEDICAL_CLINIC },
    products: MEDICAL_PRODUCTS.map((p) => ({
      ...p,
      images: Array.isArray(p.images) ? p.images : [''],
      include_in_image_gen: true,
      weight: 1, // 比重統一,不再輸入
      image_styles: { scene: true, character: true, product: false, ecommerce: false },
      purchase_url: '',
    })),
    image_theme_strategy: 'per_sku',
    brand_logos: '',
    avoid_terms: ['最便宜', '保證見效', '永久', '第一', '無效退費'].join('\n'),
  };
}

// 把 clinic 物件整理成一段給 LLM / 生圖看的中文摘要
export function clinicContextText(clinic) {
  if (!clinic || typeof clinic !== 'object') return '';
  const lines = [];
  if (clinic.name_zh || clinic.name) lines.push(`診所：${clinic.name_zh || clinic.name}${clinic.name && clinic.name_zh ? `（${clinic.name}）` : ''}`);
  if (clinic.location) lines.push(`地點：${clinic.location}`);
  if (clinic.certifications) lines.push(`認證與資質：${clinic.certifications}`);
  if (clinic.doctor_team) lines.push(`醫療團隊：${clinic.doctor_team}`);
  if (clinic.service) lines.push(`服務：${clinic.service}`);
  if (clinic.package) lines.push(`旅遊套餐：${clinic.package}`);
  if (clinic.line) lines.push(`LINE：${clinic.line}`);
  return lines.join('\n');
}
