// AI 主題推薦:依產品設定推薦 5–8 個客製化主題,每個 map 到 universal type
import { callJSON } from './llm.js';
import { typeMenu } from './schemas.js';
import { normalizeInput, productsBriefForPrompt, avoidPromptHint } from './normalize.js';

const SYSTEM = `你是一位專精台灣 Threads 社群經營的策略師,擅長從產品特色設計多元的內容主題組合。

**你的任務**:輸入一個品牌的產品設定,推薦 5–8 個客製化主題名(不是通用名,要符合該品牌的調性)。

**8 種 universal 主題類型(每個推薦主題必須 map 到其中一種)**:
${typeMenu().map(t => `- ${t.key}: ${t.label} — ${t.hint}`).join('\n')}

**規則**:
1. 主題名要客製化、要有品牌個性,不要只叫「產品介紹」「語錄」這種通用名
   - 87 烤魚做的是「霸氣語錄」「霸氣87」「心理測驗」「笑話」「餐點」「聚餐」
   - 瑞際做的是「新風短文」「讀空氣」「NX250新風」(產品名)「C3510(帶網址)」
   - Infuz 做的是「身形診斷」「穿衣哲學」「氣象穿搭」「身型小教室」
2. 5–8 個主題裡至少包含:1 個產品直接介紹型 + 1 個觀點/語錄型 + 1 個高互動或測驗型
3. 排程時間要錯開,避免擠在同一時段
4. 每個主題給推薦篇數(預設 30/月,但語錄類可以多、產品類較少)
5. 平台預設 Threads,若用戶選 IG/FB 則部分主題選擇性勾選

**輸出 JSON 格式(嚴格遵守)**:
{
  "themes": [
    {
      "name": "主題名(客製化)",
      "type": "universal_type_key",
      "rationale": "為什麼推薦這個主題給此品牌(1 句)",
      "schedule": "每日上午10點" | "每週五下午2點" | "每日下午4點",
      "monthly_count": 30,
      "platforms": ["Threads", "IG", "FB"]
    }
  ]
}`;

export async function recommendThemes(rawInput) {
  const input = normalizeInput(rawInput);
  const productsList = productsBriefForPrompt(input.products);
  const strategy = input.image_theme_strategy || 'shared';

  const strategyInstr = strategy === 'per_sku'
    ? `\n**主題分配策略: 一 SKU 一專屬主題 (per_sku)**
針對 product_with_image / product_with_url 兩種類型:
- 每個 SKU 各推 1-2 個獨立主題,主題名要明確點出 SKU 名稱
- 每個此類主題加 "locked_product_index" 欄位,值為對應 SKU 的 # (0 到 ${input.products.length - 1})
其他類型 (品牌語錄/觀點/教學/測驗/引戰/情境) 仍是品牌共用,不指定 SKU。`
    : `\n**主題分配策略: 共用主題輪替 SKU (shared)**
所有產品介紹型主題不指定特定 SKU,生成階段會自動輪替 ${input.products.length} 個 SKU。`;

  const user = `**品牌名**: ${input.brand}
**品牌定位/總體賣點**:
${input.brand_summary}

**SKU 清單(共 ${input.products.length} 個產品)**:
${productsList}

**受眾畫像**: ${input.audience}
**品牌人格**: ${input.brand_persona}
**每月想發文總量(全主題加總)**: ${input.monthly_total || 100} 篇
${strategyInstr}
${avoidPromptHint(input)}

請推薦 ${strategy === 'per_sku' ? `${input.products.length * 2}-${input.products.length * 3}` : '5–8'} 個客製化主題。`;

  const result = await callJSON({ system: SYSTEM, user, maxTokens: 4000, temperature: 0.8 });

  if (!result.themes || !Array.isArray(result.themes)) {
    throw new Error('LLM 回傳格式錯誤:缺少 themes 陣列');
  }

  // per_sku 模式下確保 product_with_* 主題有效 locked_product_index
  if (strategy === 'per_sku') {
    result.themes = result.themes.map((t) => {
      if (t.type !== 'product_with_image' && t.type !== 'product_with_url') {
        const { locked_product_index, ...rest } = t;
        return rest;
      }
      const lpi = Number.isInteger(t.locked_product_index) ? t.locked_product_index : 0;
      return {
        ...t,
        locked_product_index: lpi >= 0 && lpi < input.products.length ? lpi : 0,
      };
    });
  } else {
    // shared 模式下移除 locked_product_index
    result.themes = result.themes.map((t) => {
      const { locked_product_index, ...rest } = t;
      return rest;
    });
  }

  return result.themes;
}

/**
 * Dry-run:不打 API,回傳一組假主題用於測試 schema/排程
 */
export function recommendThemesDryRun(rawInput) {
  const input = normalizeInput(rawInput);
  const strategy = input.image_theme_strategy || 'shared';

  if (strategy === 'per_sku') {
    // 每個 SKU 各推 1 個 product_with_image 主題 + 共用觀點/語錄
    const skuThemes = input.products.map((p, i) => ({
      name: `${p.name} 專屬介紹`,
      type: 'product_with_image',
      locked_product_index: i,
      rationale: 'dry-run per_sku',
      schedule: ['每日下午4點', '每日下午1點', '每週二、五晚上9點'][i % 3],
      monthly_count: 8,
      platforms: ['Threads', 'IG'],
    }));
    return [
      ...skuThemes,
      { name: `${input.brand}觀點`, type: 'opinion_short',
        rationale: 'dry-run', schedule: '每日上午8點半',
        monthly_count: 30, platforms: ['Threads'] },
      { name: `${input.brand}語錄`, type: 'brand_quote',
        rationale: 'dry-run', schedule: '每日上午10點',
        monthly_count: 30, platforms: ['Threads'] },
    ];
  }

  // shared 模式 (預設)
  return [
    { name: `${input.product}介紹`, type: 'product_with_image',
      rationale: 'dry-run', schedule: '每日下午4點',
      monthly_count: 30, platforms: ['Threads', 'IG', 'FB'] },
    { name: `${input.product}帶網址`, type: 'product_with_url',
      rationale: 'dry-run', schedule: '每週二、四晚上8點',
      monthly_count: 10, platforms: ['Threads'] },
    { name: `${input.brand}觀點`, type: 'opinion_short',
      rationale: 'dry-run', schedule: '每日上午8點半',
      monthly_count: 30, platforms: ['Threads'] },
    { name: `${input.brand}語錄`, type: 'brand_quote',
      rationale: 'dry-run', schedule: '每日上午10點',
      monthly_count: 30, platforms: ['Threads'] },
    { name: `${input.product}小教室`, type: 'tutorial',
      rationale: 'dry-run', schedule: '每日晚上7點',
      monthly_count: 20, platforms: ['Threads'] },
    { name: `${input.brand}心理測驗`, type: 'quiz',
      rationale: 'dry-run', schedule: '每週三晚上8點',
      monthly_count: 8, platforms: ['Threads', 'IG'] },
    { name: '高互動引戰', type: 'engagement',
      rationale: 'dry-run', schedule: '每日下午6點',
      monthly_count: 30, platforms: ['Threads'] },
    { name: `${input.brand}日常觀察`, type: 'persona_narrative',
      rationale: 'dry-run', schedule: '每日晚上10點半',
      monthly_count: 30, platforms: ['Threads'] },
  ];
}
