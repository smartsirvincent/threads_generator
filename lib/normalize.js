// 把使用者輸入正規化為多產品結構,同時支援舊版 single-product input

/**
 * Canonical input shape:
 * {
 *   brand, brand_summary, audience, brand_persona,
 *   platforms[], monthly_total, start_date,
 *   purchase_url (default fallback),
 *   products: [
 *     { name, features, images[], purchase_url? }
 *   ],
 *   brand_logos: string[]      // 品牌 LOGO URL,可為空陣列代表「不要 LOGO」
 *   avoid_terms: string[]      // 禁字清單(文案/圖片都不應出現)
 *   image_styles: {            // 圖片風格偏好,影響 image themes 推薦 + 每張圖 prompt
 *     scene: boolean,          // 情境圖
 *     character: boolean,      // 人物搭配
 *     product: boolean,        // 產品為主
 *   }
 * }
 */
export function normalizeInput(raw) {
  const out = { ...raw };

  // products 陣列保證存在
  if (!Array.isArray(out.products) || out.products.length === 0) {
    out.products = [
      {
        name: raw.product || raw.brand || '主商品',
        features: raw.product_features || '',
        images: parseImages(raw.product_images),
        purchase_url: raw.purchase_url || '',
      },
    ];
  } else {
    out.products = out.products
      .map((p) => ({
        name: (p.name || '').trim(),
        features: (p.features || '').trim(),
        images: parseImages(p.images),
        purchase_url: (p.purchase_url || '').trim(),
      }))
      .filter((p) => p.name);
  }

  // brand_summary fallback
  if (!out.brand_summary) {
    out.brand_summary = raw.product_features || out.products[0]?.features || '';
  }

  // 預設 purchase_url
  out.purchase_url = out.purchase_url || raw.purchase_url || '';

  // brand_logos:陣列 of URLs
  out.brand_logos = parseImages(raw.brand_logos);

  // avoid_terms:陣列 of 字串 (從多行字串或既有陣列轉)
  if (Array.isArray(raw.avoid_terms)) {
    out.avoid_terms = raw.avoid_terms.map((s) => String(s || '').trim()).filter(Boolean);
  } else if (typeof raw.avoid_terms === 'string') {
    out.avoid_terms = raw.avoid_terms.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } else {
    out.avoid_terms = [];
  }

  // image_styles: 預設三種都開
  const rawStyles = raw.image_styles || {};
  out.image_styles = {
    scene: rawStyles.scene !== false,
    character: rawStyles.character !== false,
    product: rawStyles.product !== false,
  };
  // 至少要有一個
  if (!out.image_styles.scene && !out.image_styles.character && !out.image_styles.product) {
    out.image_styles.product = true;
  }

  // 為了 backward compat,也填回單品欄位
  if (!out.product) out.product = out.products[0]?.name || out.brand;
  if (!out.product_features) out.product_features = out.brand_summary;
  if (!out.product_images || (Array.isArray(out.product_images) && out.product_images.length === 0)) {
    out.product_images = out.products.flatMap((p) => p.images);
  }

  return out;
}

/**
 * 從 image_styles 拿啟用的風格名稱清單
 */
export function enabledImageStyles(input) {
  const s = input.image_styles || {};
  const out = [];
  if (s.scene) out.push('scene');
  if (s.character) out.push('character');
  if (s.product) out.push('product');
  return out.length > 0 ? out : ['product'];
}

/**
 * 給 prompt 用的「禁字提示句」,沒禁字回空字串
 */
export function avoidPromptHint(input) {
  const terms = input.avoid_terms || [];
  if (terms.length === 0) return '';
  return `\n\n**嚴禁在文案或圖片中提及/出現以下內容**:\n${terms.map((t) => `- ${t}`).join('\n')}\n(不可以用變體、暗示、同義詞迂迴提到)`;
}

/**
 * 給 image prompt 用的「LOGO 處理」說明
 */
export function logoPromptHint(input, addAsRef = false) {
  if (Array.isArray(input.brand_logos) && input.brand_logos.length > 0) {
    return addAsRef
      ? 'Brand logo MAY appear subtly in the composition. Use the provided logo reference; do not invent or stylize it.'
      : 'A brand logo file has been provided as reference.';
  }
  return 'NO brand logo, NO brand name text, NO brand mark of any kind in the image. Do not invent or hallucinate any logo or text.';
}

function parseImages(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  if (typeof v === 'string') {
    return v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * 把 products 變成 LLM prompt 用的精簡描述
 */
export function productsBriefForPrompt(products) {
  return products
    .map(
      (p, i) =>
        `[#${i}] ${p.name}\n  特色: ${p.features.slice(0, 200)}${p.features.length > 200 ? '…' : ''}`
    )
    .join('\n\n');
}
