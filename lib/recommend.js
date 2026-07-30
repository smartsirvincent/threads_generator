// AI 主題推薦:依產品設定推薦 5–8 個客製化主題,每個 map 到 universal type
import { callJSON } from './llm.js';
import { typeMenu } from './schemas.js';
import { normalizeInput, productsBriefForPrompt, avoidPromptHint, getEnabledProductsForImageGen } from './normalize.js';

const SYSTEM = `你是一位專精台灣醫美診所 Threads 社群經營的策略師,擅長從療程特色設計多元的內容主題組合。品牌口吻走「閨蜜」感,醫療廣告合規(不誇大、不保證療效)。

**你的任務**:輸入一個醫美診所的療程設定,推薦 5–8 個客製化主題名(不是通用名,要符合該診所的閨蜜調性)。

**8 種 universal 主題類型(每個推薦主題必須 map 到其中一種)**:
${typeMenu().map(t => `- ${t.key}: ${t.label} — ${t.hint}`).join('\n')}

**規則**:
1. 主題名要客製化、要有閨蜜口吻,不要只叫「療程介紹」「語錄」這種通用名
   - 醫美診所可做的:「水光肌日記」「鬆弛救星」(療程介紹)、「閨蜜悄悄話」「醫美迷思破解」「變美前必看」(觀點/衛教)、「妳的臉在跟妳求救?」(高互動)、「曼谷變美之旅」(情境)、「療程小教室」(教學)
2. 5–8 個主題裡至少包含:1 個療程直接介紹型 + 1 個觀點/語錄型 + 1 個高互動或測驗型
3. 排程時間要錯開,避免擠在同一時段
4. 每個主題給推薦篇數(預設 30/月,語錄/衛教類可以多、療程介紹類較少)
5. 平台預設 Threads,若用戶選 IG/FB 則部分主題選擇性勾選
6. **醫療合規**:不用「保證見效/永久/最便宜/第一」等字眼,講「自然、改善、漸進」

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
  const enabled = getEnabledProductsForImageGen(input); // [{product, originalIndex}] — 只用勾選「納入生成」的療程
  const brandGeneral = enabled.length === 0;
  const strategy = input.image_theme_strategy || 'shared';
  const enabledCount = enabled.length;

  const productsList = brandGeneral
    ? '(本次未指定任何療程 → 以品牌整體為主)'
    : enabled
        .map(({ product, originalIndex }) => `[#${originalIndex}] ${product.name}（比重 ${product.weight || 1}）\n  特色: ${product.features.slice(0, 200)}${product.features.length > 200 ? '…' : ''}`)
        .join('\n\n');

  const allowedIdx = enabled.map((e) => e.originalIndex);

  const strategyInstr = brandGeneral
    ? `\n**本次以「品牌整體」為主(未選任何療程)**
- 不要產生 product_with_image / product_with_url 這種指向特定療程的主題
- 只推品牌語錄 / 觀點 / 衛教教學 / 測驗 / 高互動 / 情境 等品牌層級主題`
    : strategy === 'per_sku'
      ? `\n**療程分配策略: 一療程一專屬主題 (per_sku)**
針對 product_with_image / product_with_url 兩種類型:
- 每個療程各推 **剛好 1 個**獨立主題 (不要多),主題名要明確點出療程名稱
- 每個此類主題加 "locked_product_index" 欄位,值必須是這些允許的療程 #: ${allowedIdx.join(', ')}
- 另外再加 2-3 個品牌共用主題 (語錄/觀點/衛教/互動),不指定療程。`
      : `\n**療程分配策略: 共用主題輪用療程 (shared)**
療程介紹型主題不指定特定療程,生成階段會依「比重」自動輪用這 ${enabledCount} 個已選療程。`;

  const user = `**診所名**: ${input.brand}
**診所定位/總體賣點**:
${input.brand_summary}

**已選療程清單(共 ${enabledCount} 個)**:
${productsList}

**受眾畫像**: ${input.audience}
**品牌人格(口吻)**: ${input.brand_persona}
**每月想發文總量(全主題加總)**: ${input.monthly_total || 100} 篇
${strategyInstr}
${avoidPromptHint(input)}

請推薦 ${!brandGeneral && strategy === 'per_sku' ? `${enabledCount + 2}-${enabledCount + 3}` : '5–8'} 個客製化主題。`;

  const result = await callJSON({ system: SYSTEM, user, maxTokens: 4000, temperature: 0.8 });

  if (!result.themes || !Array.isArray(result.themes)) {
    throw new Error('LLM 回傳格式錯誤:缺少 themes 陣列');
  }

  const isProductTheme = (t) => t.type === 'product_with_image' || t.type === 'product_with_url';

  if (brandGeneral) {
    // 品牌整體:剔除指向療程的主題,其餘移除 locked
    result.themes = result.themes
      .filter((t) => !isProductTheme(t))
      .map(({ locked_product_index, ...rest }) => rest);
  } else if (strategy === 'per_sku') {
    // per_sku:product_with_* 需有有效 locked_product_index (限已選療程)
    const fallbackIdx = allowedIdx[0] ?? 0;
    result.themes = result.themes.map((t) => {
      if (!isProductTheme(t)) {
        const { locked_product_index, ...rest } = t;
        return rest;
      }
      const lpi = Number.isInteger(t.locked_product_index) ? t.locked_product_index : fallbackIdx;
      return { ...t, locked_product_index: allowedIdx.includes(lpi) ? lpi : fallbackIdx };
    });
  } else {
    // shared:移除 locked_product_index
    result.themes = result.themes.map(({ locked_product_index, ...rest }) => rest);
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
