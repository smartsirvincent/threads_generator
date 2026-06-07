// 把使用者輸入正規化為多產品結構,同時支援舊版 single-product input

/**
 * Canonical input shape:
 * {
 *   brand, brand_summary, audience, brand_persona,
 *   platforms[], monthly_total, start_date,
 *   purchase_url (default fallback),
 *   products: [
 *     { name, features, images[], purchase_url? }
 *   ]
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

  // 為了 backward compat,也填回單品欄位
  if (!out.product) out.product = out.products[0]?.name || out.brand;
  if (!out.product_features) out.product_features = out.brand_summary;
  if (!out.product_images || (Array.isArray(out.product_images) && out.product_images.length === 0)) {
    out.product_images = out.products.flatMap((p) => p.images);
  }

  return out;
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
