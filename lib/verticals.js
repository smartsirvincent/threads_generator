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
    key: 'treatment_room', zh: '療程進行中（質感）',
    en: 'Tasteful modern aesthetic treatment room: elegant device and clean linens, a calm woman comfortably receiving a gentle non-invasive skin treatment, soft clinical-luxury lighting. Absolutely no needles, no blood, no gore shown.',
  },
  {
    key: 'product_stilllife', zh: '質感靜物 / 藥劑瓶身',
    en: 'Premium still-life composition of the physical product (vial / box / device) resting on marble with soft draped fabric, fresh flowers and champagne-gold accents, luxury skincare-advertisement lighting.',
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

export const MEDICAL_PRODUCTS = [
  {
    name: '水光肌組合',
    features:
      '由內而外綻放自然光澤的膚況——飽水透亮、有光澤、沒有黯沉與細紋，不靠高光就氣色紅潤。專門藥劑組合，做完保證有水光肌。適合作息不規律、長時間待冷氣房、肌膚乾燥粗糙的現代人。',
    promo_offer: '1,999／cc；整瓶 8cc 特惠 13,999',
    image_focus: '透亮飽水的水光肌特寫、臉部自然光澤、乾淨明亮',
    images: [''],
  },
  {
    name: '逆時針（五點提針）',
    features:
      '以刺激膠原蛋白增生為主的再生療程，不是填充撐膨，而是讓皮膚自己長回支撐力：線條自然不僵硬、無異物感。改善法令紋、木偶紋、淚溝、眼下凹陷、下巴鬆弛、毛孔、暗沉。效果漸進、維持力佳，通常施打三次（第二次隔一個月、第三次隔六個月）。',
    promo_offer: '19,999／2cc（一支 2cc）',
    image_focus: '自然緊緻的臉部線條、柔和輪廓、由內而外的年輕感',
    images: [''],
  },
  {
    name: '皮秒雷射',
    features:
      '在一兆分之一秒釋放能量的高科技雷射，把黑色素震碎得更細、加速代謝、恢復輕鬆。多數人術後只有輕微泛紅很快退，幾乎不影響上班上課，2–3 小時可快速上妝，不用長時間遮掩恢復期。',
    promo_offer: '999／單次',
    image_focus: '乾淨透亮的膚質、淡斑後的均勻膚色、輕鬆日常感',
    images: [''],
  },
  {
    name: '喬雅露 Juvelook',
    features:
      '韓國正宗 Juvelook，劃時代將聚雙旋乳酸（PDLLA）與玻尿酸（HA）結合，是目前唯一可用於真皮層注射的小分子組織增生劑。一次達成緊緻、澎潤、撫紋、改善痘疤等多重目的並提升膚況，幫助消除眼袋暗沉。零栓塞、不易結節，通過 KFDA 與 CE 雙重認可。',
    promo_offer: '1,999／cc；100U 11,111',
    image_focus: '澎潤緊緻的膚質、飽滿有彈性、細緻毛孔',
    images: [''],
  },
  {
    name: '瑞典玻尿酸 Restylane',
    features:
      '來自瑞典大廠 Q-Med 的 Restylane（瑞絲朗），全球第一個獲美國 FDA 認證的玻尿酸，NASHA 非動物性穩定技術，生物相容性高、最接近人體天然玻尿酸。用於淚溝、法令紋、蘋果肌、下巴、唇部填充與塑形，打完當下就有感，效果自然。尤其擅長唇和下巴。療程後兩週不建議三溫暖、蒸氣、溫泉。',
    promo_offer: '9,999／cc',
    image_focus: '精緻的臉部比例與立體五官、自然澎潤的唇與下巴線條',
    images: [''],
  },
  {
    name: '完美電波 Oligio',
    features:
      '0.5MHz–2MHz 多頻率多探頭，可分層（表皮/真皮/皮下/筋膜）精準治療；即時阻抗監測自動調節能量，安全有效、熱痛感相對低。可用於全臉拉提與身體（腹部/手臂/大腿）、眼周、頸部緊緻。單次治療 1–3 個月達高峰，效果約可維持 1–1.5 年。極度依賴專業醫師操作。',
    promo_offer: '4,999／100 發（適合旅遊期間）',
    image_focus: '緊緻拉提後的臉部輪廓、下顎線清晰、放鬆舒適的療程氛圍',
    images: [''],
  },
  {
    name: '海芙音波三代 HIFU',
    features:
      '高強度聚焦超音波，能量精準聚焦到 SMAS 筋膜層（手術拉皮才會處理的層次），在 1.5/3.0/4.5mm 形成立體熱凝結點網，促進膠原新生重組，從根本解決鬆弛下垂。改善下顎線模糊、法令紋、雙下巴、眉眼下垂。治療前可透過超音波影像即時看到筋膜狀態、精準規劃，所見即所得。效果可維持 1–1.5 年以上。',
    promo_offer: '6,999／400 發（適合旅遊期間）',
    image_focus: '緊實上提的臉部輪廓、清晰下顎線、深層拉提的年輕感',
    images: [''],
  },
  {
    name: '純膠原蛋白 Collaju',
    features:
      '源自韓國的再生療程，智慧生物聚合物精準定位於需要支撐的層次，溫和活化纖維母細胞，大量持續新生自體膠原蛋白、彈力纖維與玻尿酸。即時支撐＋長期再生（約 12 個月持續刺激，2–3 個月日益明顯），效果自然無異物感。同步改善淚溝、太陽穴、臉頰凹陷與法令紋、木偶紋、輪廓鬆弛，維持可達 18–24 個月。',
    promo_offer: '15,999／3cc（適合旅遊期間）',
    image_focus: '飽滿緊緻、由內而外的膚質光澤、自然的臉頰澎潤',
    images: [''],
  },
  {
    name: '肉毒',
    features:
      '透過放鬆過度活躍的肌肉來撫平動態紋、修飾臉部線條。除皺（抬頭紋、皺眉紋、魚尾紋）之外也能瘦小臉、改善國字臉、調整下顎線，並緩解咬肌過緊、磨牙緊咬。效果數天內顯現、表情自然輕鬆、幾乎無恢復期。強調自然，很適合旅遊期間做；當天不建議躺著按摩，療程期間不建議三溫暖、蒸氣、溫泉。',
    promo_offer: '咀嚼肌 3,500 不限 U；額頭／眼尾／眉間 3,500 不限 U（適合旅遊期間）',
    image_focus: '柔和自然的表情、乾淨俐落的臉部線條、精神好的氣色',
    images: [''],
  },
  {
    name: '德國天使肉毒',
    features:
      '不含複合性蛋白質，分子小、純度高，有效降低產生肉毒抗藥性的風險，適合施打過其他廠牌、可能已產生抗體而效果不彰的個案，可說是市面上最好的肉毒之一。',
    promo_offer: '包瓶 100U 特惠 11,111',
    image_focus: '高純度質感、乾淨俐落的臉部線條、放鬆自然的表情',
    images: [''],
  },
  {
    name: '美國極限音波 Ultherapy prime',
    features:
      '又稱美音二代 / 超生刀。聚焦超音波打到皮膚深層甚至 SMAS 筋膜層，產生約 60–70°C 熱凝結點，刺激膠原新生＋組織收縮，讓臉自己變緊。適合「開始鬆但還沒垮很嚴重」（30–50 歲黃金族群），改善法令紋、嘴邊肉、下顎線模糊、雙下巴、眼尾下垂、頸部鬆弛。美國 FDA 核准、有即時影像可看到打到哪層。不用開刀、無傷口、幾乎無恢復期、一次治療即可。',
    promo_offer: '200 條 15,999／400 條 29,999／600 條 39,999',
    image_focus: '深層拉提後的緊實輪廓、清晰下顎線與頸部線條、自然上提',
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
      '像好朋友一樣真誠、務實、溫暖、誠實透明。短句、口語、不浮誇、不硬推銷、把客人當「人」而不是業績。不喊「最便宜」，強調「終於有人把妳當客人」的安心感。',
    purchase_url: '',
    industry_extra: {
      clinic: { ...MEDICAL_CLINIC },
    },
    clinic: { ...MEDICAL_CLINIC },
    products: MEDICAL_PRODUCTS.map((p) => ({
      ...p,
      images: Array.isArray(p.images) ? p.images : [''],
      include_in_image_gen: true,
      image_styles: { scene: true, character: true, product: false, ecommerce: true },
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
