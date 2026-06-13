// 圖片主題推薦 — 跟 recommend.js 差別在 prompt 完全不同
// 圖片主題例如:產品特寫、生活情境、風格化(賽博龐克/蒸氣波/極簡)、節慶主題、人物模特、場景敘事
import { callJSON } from './llm.js';
import { normalizeInput, productsBriefForPrompt, avoidPromptHint, enabledImageStyles, logoPromptHint, getEnabledProductsForImageGen } from './normalize.js';

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
- 「電商促銷」(明顯標價/折扣標籤/限時 banner/CTA 區塊,適合導購)

**image_style 四選一**:
- "scene"      情境圖,生活場景+環境敘事
- "character"  人物模特/角色搭配
- "product"    產品特寫為主,純產品/低人為干擾
- "ecommerce"  電商促銷風格,構圖需含明顯標價/活動文字/折扣徽章

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
      "image_style": "scene" | "character" | "product" | "ecommerce",
      "locked_product_index": 0,
      "visual_style": "English description of the visual style for KIE prompt prefix",
      "rationale": "為什麼推薦這個圖片主題(1 句)",
      "schedule": "每日下午4點" | "每週五下午2點" | "每日下午1點",
      "monthly_count": 12,
      "platforms": ["Threads", "IG", "FB"]
    }
  ]
}

**locked_product_index 規則**:
- per_sku 策略下:必填,值為對應 SKU 的 # (對應上方 enabled 清單的編號)
- shared 策略下:省略此欄 (或設為 null)

**image_style 三選一,必填**:
- "scene":情境/環境/敘事感(餐廳全景、廚房現場、生活角落)
- "character":人物/角色搭配(模特兒、使用者、用餐情境的人)
- "product":產品為主(特寫、純產品、低人為干擾)`;

export async function recommendImageThemes(rawInput) {
  const input = normalizeInput(rawInput);
  const enabled = getEnabledProductsForImageGen(input);
  if (enabled.length === 0) {
    throw new Error('沒有勾選任何「生圖」的產品。請在 Step 1 至少勾一個產品的「生圖」');
  }
  const strategy = input.image_theme_strategy || 'shared';

  // 把 enabled SKU 列在 prompt 中,附帶各自的可接受風格 + originalIndex + 優惠 + 視覺重點
  const enabledList = enabled.map(({ product, originalIndex }) => {
    const styles = enabledImageStyles(product);
    const extras = [];
    if (product.promo_offer) extras.push(`  優惠內容(電商促銷風格用): ${product.promo_offer}`);
    if (product.image_focus) extras.push(`  視覺強化方向: ${product.image_focus}`);
    return `[#${originalIndex}] ${product.name}\n  特色: ${product.features.slice(0, 150)}${product.features.length > 150 ? '…' : ''}\n  可接受風格: ${styles.join(', ')}${extras.length ? '\n' + extras.join('\n') : ''}`;
  }).join('\n\n');

  const strategyInstr = strategy === 'per_sku'
    ? `**策略: 一 SKU 一專屬主題**
每個 SKU 各自獨立主題,主題名要明確點出 SKU。
- 推薦 ${enabled.length}-${enabled.length * 2} 個主題,平均分配到 ${enabled.length} 個 SKU
- 每個主題在輸出加 "locked_product_index" 欄位指定該 SKU 的 # (例如 ${enabled[0].originalIndex})
- image_style 必須在該 SKU 的「可接受風格」清單內`
    : `**策略: 共用主題輪替 SKU**
推薦 5-8 個主題,每個主題在生成階段會輪替 ${enabled.length} 個 enabled SKU。
- 主題不指定特定 SKU (不要加 locked_product_index)
- image_style 必須是所有 enabled SKU 共同接受的風格,如果交集為空就挑大多數 SKU 接受的`;

  const user = `**品牌名**: ${input.brand}
**品牌定位/總體賣點**:
${input.brand_summary}

**Enabled SKU 清單 (用戶勾選了生圖的,共 ${enabled.length} 個):**
${enabledList}

**受眾畫像**: ${input.audience}
**品牌人格**: ${input.brand_persona}
**每月想生成總張數**: ${input.monthly_total || 60} 張
**啟用平台**: ${(input.platforms || ['Threads']).join(', ')}

${strategyInstr}

**品牌 LOGO**: ${logoPromptHint(input).slice(0, 120)}
${avoidPromptHint(input)}

請推薦圖片主題。`;

  const result = await callJSON({ system: SYSTEM, user, maxTokens: 4000, temperature: 0.85 });

  if (!result.themes || !Array.isArray(result.themes)) {
    throw new Error('LLM 回傳格式錯誤:缺少 themes 陣列');
  }

  // 強制 type 鎖在 product_with_image
  // 處理 locked_product_index: 只在 per_sku 模式且有效時保留
  const enabledIndexSet = new Set(enabled.map((e) => e.originalIndex));
  result.themes = result.themes.map((t) => {
    const cleaned = {
      ...t,
      type: 'product_with_image',
    };
    if (strategy === 'per_sku') {
      const lpi = Number.isInteger(t.locked_product_index) ? t.locked_product_index : enabled[0].originalIndex;
      cleaned.locked_product_index = enabledIndexSet.has(lpi) ? lpi : enabled[0].originalIndex;
    } else {
      delete cleaned.locked_product_index;
    }
    // image_style 必須在該 SKU (per_sku) 或 enabled 任一 SKU 的可接受風格內
    const allowedStyles = strategy === 'per_sku'
      ? enabledImageStyles(input.products[cleaned.locked_product_index])
      : Array.from(new Set(enabled.flatMap(({ product }) => enabledImageStyles(product))));
    cleaned.image_style = allowedStyles.includes(t.image_style) ? t.image_style : allowedStyles[0];
    return cleaned;
  });
  return result.themes;
}

const STYLE_FALLBACK_CYCLE = ['product', 'scene', 'character'];

/**
 * Dry-run:不打 API,回假主題
 */
export function recommendImageThemesDryRun(rawInput) {
  const input = normalizeInput(rawInput);
  const enabled = getEnabledProductsForImageGen(input);
  const strategy = input.image_theme_strategy || 'shared';

  if (strategy === 'per_sku' && enabled.length > 0) {
    // 每個 SKU 一個專屬主題
    return enabled.map(({ product, originalIndex }, i) => {
      const styles = enabledImageStyles(product);
      return {
        name: `${product.name} 專屬主題`,
        type: 'product_with_image',
        image_style: styles[0],
        locked_product_index: originalIndex,
        visual_style: 'product-specific dry-run',
        rationale: 'dry-run per_sku',
        schedule: ['每日下午4點', '每日下午1點', '每週二、五晚上9點'][i % 3],
        monthly_count: 6 + i,
        platforms: ['Threads', 'IG'],
      };
    });
  }

  // shared mode
  const fallbackStyles = enabled.length > 0
    ? Array.from(new Set(enabled.flatMap(({ product }) => enabledImageStyles(product))))
    : ['scene', 'character', 'product'];
  const pickStyle = (i) => fallbackStyles[i % fallbackStyles.length];
  const dry = [
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
  return dry.map((t, i) => ({ ...t, image_style: pickStyle(i) }));
}
