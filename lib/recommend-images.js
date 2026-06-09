// 圖片主題推薦 — 跟 recommend.js 差別在 prompt 完全不同
// 圖片主題例如:產品特寫、生活情境、風格化(賽博龐克/蒸氣波/極簡)、節慶主題、人物模特、場景敘事
import { callJSON } from './llm.js';
import { normalizeInput, productsBriefForPrompt } from './normalize.js';

const SYSTEM = `你是一位專精台灣 Threads/IG 視覺內容策略的攝影/設計總監,擅長從產品設計多元的圖片企劃。

**你的任務**:輸入一個品牌的產品設定,推薦 5–8 個「圖片主題」(不是貼文主題)。

**每個主題等於一個視覺風格 + 構圖企劃**,例如:
- 「產品特寫」(close-up、肌膚質感、食物特寫)
- 「生活情境」(lifestyle、使用場景、日常情景)
- 「風格化視覺」(賽博龐克、蒸氣波、北歐極簡、復古港風...)
- 「節慶/季節主題」(中秋、新年、夏日、雨季)
- 「人物模特」(模特兒穿搭/使用、表情張力)
- 「場景敘事」(餐廳全景、店面氛圍、廚房現場)
- 「對比展示」(Before/After、有用/沒用、傳統/科技)
- 「廣告排版」(主標+副標+排版設計感)

**規則**:
1. 主題名要客製化,符合品牌調性(像 87 烤魚會叫「賽博鍋物」「夜店風火鍋」、Infuz 會叫「窗邊光」「日系冷色」)
2. 5–8 個主題,涵蓋至少 3 種不同視覺風格(不要全是同質特寫)
3. 排程時間錯開 (考慮 IG/Threads 黃金時段)
4. 每個主題給推薦張數(預設 8-15 張/月,風格化類可少、產品特寫類可多)
5. visual_style 描述用英文,因為會直接餵 KIE GPT Image 2

**輸出 JSON 格式(嚴格遵守)**:
{
  "themes": [
    {
      "name": "主題名(客製化中文)",
      "type": "product_with_image",
      "visual_style": "English description of the visual style for KIE prompt prefix",
      "rationale": "為什麼推薦這個圖片主題(1 句)",
      "schedule": "每日下午4點" | "每週五下午2點" | "每日下午1點",
      "monthly_count": 12,
      "platforms": ["Threads", "IG", "FB"]
    }
  ]
}`;

export async function recommendImageThemes(rawInput) {
  const input = normalizeInput(rawInput);
  const productsList = productsBriefForPrompt(input.products);

  const user = `**品牌名**: ${input.brand}
**品牌定位/總體賣點**:
${input.brand_summary}

**SKU 清單(共 ${input.products.length} 個產品)**:
${productsList}

**受眾畫像**: ${input.audience}
**品牌人格**: ${input.brand_persona}
**每月想生成總張數**: ${input.monthly_total || 60} 張
**啟用平台**: ${(input.platforms || ['Threads']).join(', ')}

請推薦 5–8 個圖片主題,涵蓋多種視覺風格。`;

  const result = await callJSON({ system: SYSTEM, user, maxTokens: 4000, temperature: 0.85 });

  if (!result.themes || !Array.isArray(result.themes)) {
    throw new Error('LLM 回傳格式錯誤:缺少 themes 陣列');
  }

  // 強制 type 鎖在 product_with_image
  result.themes = result.themes.map((t) => ({ ...t, type: 'product_with_image' }));
  return result.themes;
}

/**
 * Dry-run:不打 API,回假主題
 */
export function recommendImageThemesDryRun(rawInput) {
  const input = normalizeInput(rawInput);
  return [
    { name: `${input.product || '產品'}特寫`, type: 'product_with_image',
      visual_style: 'close-up product shot, dramatic lighting',
      rationale: 'dry-run', schedule: '每日下午4點',
      monthly_count: 15, platforms: ['Threads', 'IG', 'FB'] },
    { name: `${input.brand}生活情境`, type: 'product_with_image',
      visual_style: 'lifestyle scene, natural daylight',
      rationale: 'dry-run', schedule: '每日下午1點',
      monthly_count: 12, platforms: ['Threads', 'IG'] },
    { name: '賽博龐克視覺', type: 'product_with_image',
      visual_style: 'cyberpunk style, neon lighting, futuristic',
      rationale: 'dry-run', schedule: '每週二、五晚上9點',
      monthly_count: 8, platforms: ['Threads', 'IG'] },
    { name: '節慶主題視覺', type: 'product_with_image',
      visual_style: 'festive seasonal background, warm colors',
      rationale: 'dry-run', schedule: '每週一、四中午12點',
      monthly_count: 8, platforms: ['Threads', 'IG', 'FB'] },
    { name: '場景敘事', type: 'product_with_image',
      visual_style: 'environmental wide shot, storytelling composition',
      rationale: 'dry-run', schedule: '每週三、六晚上7點',
      monthly_count: 10, platforms: ['Threads', 'IG'] },
    { name: '極簡美學', type: 'product_with_image',
      visual_style: 'minimalist composition, clean background, editorial style',
      rationale: 'dry-run', schedule: '每週日上午10點',
      monthly_count: 5, platforms: ['IG', 'FB'] },
  ];
}
