// 整月內容批次生成
// 每個主題分批呼叫(每批 ≤ 10 篇),累積到指定 monthly_count
import { callJSON } from './llm.js';
import { getPostType } from './schemas.js';
import { normalizeInput, productsBriefForPrompt, avoidPromptHint, getEnabledProductsForImageGen } from './normalize.js';

const BATCH_SIZE = 8;

/**
 * 依主題類型決定每批量
 * - product_with_image 17 欄,Claude 生成單批會吐很多 → 4
 * - product_with_url 4 欄 → 6
 * - 純文字類 (語錄/觀點/測驗/教學/引戰/情境) 2-5 欄 → 8
 */
export const BATCH_SIZE_BY_TYPE = {
  product_with_image: 4,
  product_with_url: 6,
  opinion_short: 8,
  brand_quote: 8,
  tutorial: 6,
  quiz: 8,
  engagement: 8,
  persona_narrative: 5,
};

export function batchSizeForType(type) {
  return BATCH_SIZE_BY_TYPE[type] || BATCH_SIZE;
}

/**
 * 取得 theme 應該用的 SKU 池(帶 originalIndex)
 * - product_with_image + locked_product_index → 該單 SKU
 * - product_with_image (no lock) → enabled SKU
 * - 其他 → 全部 SKU
 */
function themePool(theme, input) {
  const all = (input.products || []).map((p, i) => ({ product: p, originalIndex: i }));
  if (theme.type === 'product_with_image') {
    if (Number.isInteger(theme.locked_product_index)
      && theme.locked_product_index >= 0
      && theme.locked_product_index < all.length) {
      return [all[theme.locked_product_index]];
    }
    const enabled = getEnabledProductsForImageGen(input);
    if (enabled.length > 0) return enabled;
  }
  return all.length > 0 ? all : [{ product: { name: '產品', features: '' }, originalIndex: 0 }];
}

/**
 * 安全地截短字串:
 * 1. 去除不成對的 UTF-16 surrogate(避免 Claude API JSON parse 報 no low surrogate)
 * 2. 用 code points 切而不是 code units(emoji 等 surrogate pair 不會被切半)
 */
function safeTrim(str, max = 50) {
  if (!str) return '';
  const cleaned = String(str)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
  return [...cleaned].slice(0, max).join('');
}

/**
 * 依 universal type 取對應的 prompt 範本 + JSON schema
 */
function buildBatchPrompt({ theme, input, batchIndex, batchCount, totalSoFar, previousTitles }) {
  const type = getPostType(theme.type);
  const isProductTheme = theme.type === 'product_with_image' || theme.type === 'product_with_url';
  const allProducts = input.products || [];

  // 決定本批次可用的 SKU 池 (帶原 index)
  // product_with_image 主題:有 locked → 只用該 SKU;否則用 enabled SKU
  // 其他類型:用全部 SKU
  let pool = allProducts.map((p, i) => ({ product: p, originalIndex: i }));
  if (theme.type === 'product_with_image') {
    if (Number.isInteger(theme.locked_product_index)
      && theme.locked_product_index >= 0
      && theme.locked_product_index < allProducts.length) {
      pool = [{ product: allProducts[theme.locked_product_index], originalIndex: theme.locked_product_index }];
    } else {
      const enabled = getEnabledProductsForImageGen(input);
      if (enabled.length > 0) pool = enabled;
    }
  }
  const products = pool.map((e) => e.product);
  const allowedIndices = pool.map((e) => e.originalIndex);
  // productsList 顯示時用 originalIndex,讓 LLM 學會使用真實 SKU index
  const productsList = pool
    .map(({ product, originalIndex }) => `[#${originalIndex}] ${product.name}\n  特色: ${product.features.slice(0, 200)}${product.features.length > 200 ? '…' : ''}`)
    .join('\n\n');

  const sharedContext = `**品牌**: ${input.brand}
**品牌定位**:
${input.brand_summary}

**SKU 清單(共 ${products.length} 個)**:
${productsList}

**受眾**: ${input.audience}
**品牌人格**: ${input.brand_persona}

**本主題名**: ${theme.name}
**主題類型**: ${type.label}
**主題提示**: ${type.promptHint}
${avoidPromptHint(input)}`;

  // 各 type 專屬 schema(輸出 JSON 結構)
  const schemas = {
    product_with_image: `[
  {
    "product_index": 0,
    "主題類型": "情緒共鳴|引流導購|教育內容|品牌故事...",
    "受眾": "具體受眾(如:都市獨居女子)",
    "切入點": "(如:安全與通風)",
    "開頭鉤子類型": "感性舒壓|導購推坑|商業視野|懸念質問...",
    "首句Hook": "第一句話",
    "核心痛點": "具體痛點",
    "產品亮點": "用到該 SKU 的具體功能/賣點",
    "情緒語法": "安定感|帥氣乾脆|專業權威...",
    "CTA": "互動觸發句",
    "場景設定": "讀者讀的當下場景",
    "字數": 200,
    "文案內容": "完整 Threads 貼文(含換行 \\n,內容必須圍繞 product_index 指向的 SKU)",
    "Prompt核心關鍵字": "AI 圖片 prompt 關鍵字英文(描述該 SKU 的視覺特色)"
  }
]
**重要**: product_index 必須是上方清單中的 # (允許值: ${allowedIndices.join(', ')}),代表這篇文案是針對哪個 SKU。${products.length > 1 ? '這批 ' + batchCount + ' 篇要盡量輪替不同 SKU,不要全寫同一個。' : '所有篇都用同一個 SKU: #' + allowedIndices[0]}`,

    product_with_url: `[
  { "product_index": 0,
    "主題分類": "迷思破解|功能介紹|使用情境|限時優惠...",
    "文案內容": "完整 Threads 貼文(結尾含購買連結 + hashtag,內容圍繞 product_index 指向的 SKU)" }
]
**重要**: product_index 必須是上方清單中的 # (允許值: ${allowedIndices.join(', ')})。${products.length > 1 ? '這批要盡量輪替不同 SKU。' : ''}`,

    opinion_short: `[
  { "主題分類": "問題意識|生活觀察|產業洞察...",
    "主題": "本篇的觀點主題(短)",
    "文案內容": "100-200字觀點短文(用 \\n 分段)" }
]`,

    brand_quote: `[
  { "主題": "本篇金句的主題",
    "文案內容": "短語錄(3 段式或反轉式,用 \\n 分段,80-120字)" }
]`,

    tutorial: `[
  { "主題分類": "對象/情況分類(如梨形/小腹/X型腿)",
    "標題": "教學標題(吸引人)",
    "文案內容": "教學內容(問題→原理→解法→帶出產品,140-200字)" }
]`,

    quiz: `[
  { "題目": "心理測驗題目",
    "選項A": "選項 A(短)",
    "選項B": "選項 B",
    "選項C": "選項 C",
    "選項D": "選項 D" }
]`,

    engagement: `[
  { "文案內容": "一句 hook + 留言/標記 CTA(50-100字)" }
]`,

    persona_narrative: `[
  { "角色": "敘事者身份(室內設計師/職場主管/氣象主播...)",
    "場景": "故事發生的場景",
    "文案內容": "從角色視角觀察的 200-350 字故事,結尾把產品當解方帶入(用 \\n 分段)" }
]`,
  };

  const dupeHint = previousTitles.length > 0
    ? `\n**重要:不要重複下列已生過的角度**:\n${previousTitles.slice(-20).map(t => `- ${t}`).join('\n')}`
    : '';

  const system = `你是台灣 Threads 社群文案專家,專門寫 ${input.brand_persona} 風格的內容。

${sharedContext}

**輸出規則**:
1. 嚴格回 JSON 陣列,陣列裡 ${batchCount} 筆物件
2. 文案要符合 Threads 風格:口語、有換行、有節奏感
3. 每篇角度/Hook 不可重複
4. 用品牌人格說話,不要 AI 味
5. 適時用 emoji 但不要太多(每篇 0-2 個)
6. ${type.promptHint}

**JSON schema**:
${schemas[theme.type]}
${dupeHint}`;

  const user = `這是這個主題的第 ${batchIndex + 1} 批(目前已生 ${totalSoFar} 篇,還要 ${batchCount} 篇)。
請給我 ${batchCount} 篇 JSON 陣列,不要任何說明文字,直接回 JSON。`;

  return { system, user };
}

/**
 * 生成單一主題的所有貼文,回傳貼文陣列
 */
export async function generateThemePosts({ theme, input: rawInput, onProgress }) {
  const input = normalizeInput(rawInput);
  const count = theme.monthly_count || 30;
  const posts = [];
  const previousTitles = [];

  const batches = Math.ceil(count / BATCH_SIZE);
  for (let b = 0; b < batches; b++) {
    const remaining = count - posts.length;
    const batchCount = Math.min(BATCH_SIZE, remaining);

    onProgress?.({ phase: 'batch', theme: theme.name, batch: b + 1, batches, posts: posts.length, target: count });

    const { system, user } = buildBatchPrompt({
      theme, input, batchIndex: b, batchCount, totalSoFar: posts.length, previousTitles,
    });

    let batch;
    try {
      batch = await callJSON({ system, user, maxTokens: 8000, temperature: 0.95 });
    } catch (e) {
      console.error(`  ⚠️ batch ${b + 1} 失敗,跳過: ${e.message}`);
      continue;
    }

    if (!Array.isArray(batch)) {
      console.error(`  ⚠️ batch ${b + 1} 不是陣列,跳過`);
      continue;
    }

    posts.push(...batch);
    for (const p of batch) {
      const raw = p.主題 || p.標題 || p.首句Hook || p.題目 || p.文案內容 || p.貼文內容 || '';
      const title = safeTrim(raw, 40);
      if (title) previousTitles.push(title);
    }
  }

  return posts.slice(0, count);
}

/**
 * 單一 batch 版本:給 chunked API 用,避免單次 call 超過 Vercel 60s
 * @param {object} args
 * @param {object} args.theme
 * @param {object} args.input
 * @param {number} args.count - 這次要生成幾篇 (上限 BATCH_SIZE = 8)
 * @param {string[]} [args.previousTitles] - 已產出的標題清單,用來避免重複
 * @returns {Promise<{posts: Array, titles: string[]}>}
 */
export async function generateOneBatch({ theme, input: rawInput, count, previousTitles = [] }) {
  const input = normalizeInput(rawInput);
  const typeCap = batchSizeForType(theme.type);
  const safeCount = Math.min(Math.max(1, count || typeCap), typeCap);
  const { system, user } = buildBatchPrompt({
    theme,
    input,
    batchIndex: previousTitles.length / BATCH_SIZE,
    batchCount: safeCount,
    totalSoFar: previousTitles.length,
    previousTitles,
  });

  const batch = await callJSON({ system, user, maxTokens: 8000, temperature: 0.95 });
  if (!Array.isArray(batch)) {
    throw new Error('LLM 回傳格式錯誤:不是陣列');
  }

  const newTitles = [];
  for (const p of batch) {
    const raw = p.主題 || p.標題 || p.首句Hook || p.題目 || p.文案內容 || p.貼文內容 || '';
    const title = safeTrim(raw, 40);
    if (title) newTitles.push(title);
  }

  return { posts: batch, titles: newTitles };
}

/**
 * Dry-run 單批版本
 */
export function generateOneBatchDryRun({ theme, input: rawInput, count, startIndex = 0 }) {
  const allPosts = generateThemePostsDryRun({
    theme: { ...theme, monthly_count: startIndex + count },
    input: rawInput,
  });
  return {
    posts: allPosts.slice(startIndex, startIndex + count),
    titles: allPosts.slice(startIndex, startIndex + count).map((p, i) =>
      String(p.主題 || p.標題 || p.首句Hook || p.題目 || p.文案內容 || `dry-${startIndex + i}`).slice(0, 40)
    ),
  };
}

/**
 * Dry-run:不打 API,產假資料測 schema
 */
export function generateThemePostsDryRun({ theme, input: rawInput }) {
  const input = normalizeInput(rawInput);
  const count = theme.monthly_count || 30;
  const posts = [];
  const samples = {
    product_with_image: (i) => {
      // 依 theme.locked / enabled SKU 池輪替
      const pool = themePool(theme, input);
      const { product: p, originalIndex: pi } = pool[(i - 1) % pool.length];
      return {
        product_index: pi,
        主題類型: '情緒共鳴', 受眾: '都市白領', 切入點: '便利性',
        開頭鉤子類型: '感性舒壓', 首句Hook: `${theme.name} 第 ${i} 篇 Hook`,
        核心痛點: '時間不夠', 產品亮點: p.name, 情緒語法: '安定感',
        CTA: '留言告訴我你的選擇', 場景設定: '加班深夜', 字數: 200,
        文案內容: `[Dry-run] ${theme.name} 第 ${i} 篇\nSKU: ${p.name}\n${(p.features || '').slice(0, 50)}...`,
        Prompt核心關鍵字: `${p.name} cozy modern lifestyle photography`,
      };
    },
    product_with_url: (i) => {
      const pool = themePool(theme, input);
      const { product: p, originalIndex: pi } = pool[(i - 1) % pool.length];
      return {
        product_index: pi,
        主題分類: '功能介紹',
        文案內容: `[Dry-run] ${theme.name} 第 ${i} 篇 (${p.name})\n${(p.features || '').slice(0, 80)}\n${p.purchase_url || input.purchase_url || ''}`,
      };
    },
    opinion_short: (i) => ({
      主題分類: '問題意識',
      主題: `${theme.name} 第 ${i} 篇主題`,
      文案內容: `[Dry-run]\n\n${input.brand_persona}風格觀點 ${i}\n\n${input.product_features.slice(0, 40)}...`,
    }),
    brand_quote: (i) => ({
      主題: `${theme.name} ${i}`,
      文案內容: `[Dry-run 第 ${i} 篇]\n\n短語錄。\n\n${input.brand_persona}。`,
    }),
    tutorial: (i) => ({
      主題分類: '基礎教學',
      標題: `${theme.name} 第 ${i} 篇`,
      文案內容: `[Dry-run] 教學內容 ${i}\n\n問題→原理→解法→${input.product}`,
    }),
    quiz: (i) => ({
      題目: `${theme.name} 第 ${i} 題?`,
      選項A: '選項 A', 選項B: '選項 B', 選項C: '選項 C', 選項D: '選項 D',
    }),
    engagement: (i) => ({
      文案內容: `[Dry-run] ${theme.name} 第 ${i} 篇 hook,留言 +1`,
    }),
    persona_narrative: (i) => ({
      角色: '室內設計師',
      場景: '客戶討論',
      文案內容: `[Dry-run] ${theme.name} 第 ${i} 篇\n\n從設計師角度...\n\n用 ${input.product} 解決。`,
    }),
  };
  const fn = samples[theme.type] || samples.opinion_short;
  for (let i = 1; i <= count; i++) posts.push(fn(i));
  return posts;
}
