// 素材產生器:用 KIE 並行生 3 張不同尺寸的素材
// KIE 原生只支援 1:1 / 3:2 / 2:3,9:16 和 1.91:1 用 Cloudinary 轉換裁切
import { NextResponse } from 'next/server';
import { submitImageV2, pollImageV2, downloadImage } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const STYLE_PROMPT = 'Create a new original image inspired by the visual style of the reference. Maintain the color palette, lighting, mood, composition style, depth of field, and overall aesthetic. Do NOT replicate exact content or specific objects from the reference. Photorealistic, high quality, social media ready.';

/**
 * 用產品資料 + 選擇的標題/文案 build 更具體的 prompt
 */
function buildProductPrompt({ product, title, subtitle, copy, brand, brand_persona, useLogo, hasCompositionRef, omitCopy }) {
  if (!product) return STYLE_PROMPT;
  const parts = [];

  parts.push(`Create a high-quality social media visual featuring the product: "${product.name}".`);
  if (product.features) parts.push(`Product key traits: ${product.features.slice(0, 200)}`);
  if (product.image_focus) parts.push(`Visual emphasis: ${product.image_focus}`);
  if (product.promo_offer) parts.push(`Promotional context: ${product.promo_offer}`);

  if (title) {
    parts.push(`Render the main headline "${title}" as bold legible text overlay within the composition (typographically integrated, not floating).`);
  }
  if (subtitle) {
    parts.push(`Render subheadline: "${subtitle}" smaller but readable.`);
  }
  if (copy && !omitCopy) {
    parts.push(`Mood reference (do not render as text): ${copy.slice(0, 100)}`);
  }
  if (brand) parts.push(`Brand: ${brand}.`);
  if (brand_persona) parts.push(`Brand vibe: ${brand_persona.slice(0, 60)}.`);

  // 多參考圖時要明確說明每張角色
  if (useLogo && hasCompositionRef) {
    parts.push('Reference images (in order): [1] Product appearance source, [2] Brand logo to subtly include, [3] Composition / layout inspiration. Do NOT copy reference 1\'s background. Use reference 3 ONLY for composition / framing / camera angle.');
    parts.push('Include the brand logo subtly in a corner. Do not distort or invent variations of the logo.');
  } else if (useLogo) {
    parts.push('Reference images (in order): [1] Product appearance source, [2] Brand logo to subtly include. Do NOT copy reference 1\'s background. Design a fresh composition.');
    parts.push('Include the brand logo subtly in a corner. Do not distort or invent variations of the logo.');
  } else if (hasCompositionRef) {
    parts.push('Reference images (in order): [1] Product appearance source, [2] Composition / layout inspiration. Do NOT copy reference 1\'s background. Use reference 2 ONLY for composition / framing / camera angle, NOT for product or color.');
    parts.push('STRICT: NO brand logo, NO brand name as text, NO invented logos in the image.');
  } else {
    parts.push('Use the reference image as the product appearance source. Do not copy its background or composition — design a fresh layout.');
    parts.push('STRICT: NO brand logo, NO brand name as text, NO invented logos in the image.');
  }

  // ===== 嚴格保留產品原貌 (對所有 mode 都強制) =====
  parts.push('CRITICAL PRODUCT FIDELITY: Preserve the EXACT original colors, shape, packaging design, label artwork, and any visible logos or text printed ON the product itself. Do NOT recolor the product. Do NOT alter, hallucinate, or remove any branding, labels, or product markings. The product must look identical to the reference, only the background/composition/style around it should change.');

  // ===== 最強制:絕對禁止新包裝 (這條是 hard rule,不可違反) =====
  parts.push('ABSOLUTELY FORBIDDEN — HARD RULE: Under NO circumstances may you invent, redesign, replace, modify, or stylize the product packaging. The packaging in the output image MUST be pixel-faithful to the reference. Do NOT create new packaging variants. Do NOT redraw labels. Do NOT swap container shapes. If you cannot keep the packaging identical, output the product as-is from the reference rather than imagining a new one. This rule overrides any other creative direction.');

  parts.push('Photorealistic, high quality, social media ready, vibrant lighting, conversion-focused composition.');
  return parts.join(' ');
}

// target: 用戶看到的尺寸名;kieAr: 餵 KIE V2 的 aspect_ratio;cloudinaryAr: 微調到精確比例(null = 不調)
// KIE V2 原生支援 1:1, 9:16, 16:9 等;1.91:1 用 16:9 + 微裁切
const SIZE_MAP = [
  { target: '1:1', kieAr: '1:1', cloudinaryAr: null },                // 1:1 原生
  { target: '9:16', kieAr: '9:16', cloudinaryAr: null },              // 9:16 原生(IG Stories/Reels)
  { target: '1.91:1', kieAr: '16:9', cloudinaryAr: '191:100' },       // 16:9 (1.78) 微擴張到 1.91 (FB 廣告)
];

function applyCloudinaryAspect(url, ar) {
  if (!ar) return url;
  // url 形如 https://res.cloudinary.com/<cloud>/image/upload/v123/folder/foo.png
  // 插入 c_fill,g_auto,ar_X:Y,w_1080 到 /upload/ 後
  return url.replace('/image/upload/', `/image/upload/c_fill,g_auto,ar_${ar},w_1080/`);
}

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: '雲端儲存未設定' }, { status: 503 });
    }
    const {
      refUrl,
      extraPrompt,
      product,
      title,
      subtitle,
      copy,
      brand,
      brand_persona,
      logoUrl,         // 品牌 LOGO URL (選填)
      useLogo,         // 是否合成 LOGO
      compositionRefUrl, // 構圖參考圖 URL (選填)
      omitCopy,        // 不增加文案 (主標副標仍保留)
    } = await req.json();
    if (!refUrl || typeof refUrl !== 'string') {
      return NextResponse.json({ error: 'refUrl required' }, { status: 400 });
    }

    // 組合多參考圖 (順序很重要,prompt 會用 [1][2][3] 指)
    const inputUrls = [refUrl];
    if (useLogo && logoUrl) inputUrls.push(logoUrl);
    if (compositionRefUrl) inputUrls.push(compositionRefUrl);

    const basePrompt = product
      ? buildProductPrompt({
          product, title, subtitle, copy, brand, brand_persona,
          useLogo: !!(useLogo && logoUrl),
          hasCompositionRef: !!compositionRefUrl,
          omitCopy: !!omitCopy,
        })
      : STYLE_PROMPT;
    const prompt = extraPrompt ? `${basePrompt}\n\nExtra direction: ${extraPrompt}` : basePrompt;

    // 並行 3 個 KIE V2 call (原生 aspect_ratio,不再走老 endpoint)
    const results = await Promise.all(SIZE_MAP.map(async (spec) => {
      const t0 = Date.now();
      try {
        const taskId = await submitImageV2({
          prompt,
          referenceImages: inputUrls,
          aspect_ratio: spec.kieAr,
        });
        const kieUrl = await pollImageV2(taskId);
        const buffer = await downloadImage(kieUrl);
        const up = await uploadToCloudinary(buffer, { folder: 'material/results' });
        const finalUrl = applyCloudinaryAspect(up.url, spec.cloudinaryAr);
        return {
          target: spec.target,
          kieAr: spec.kieAr,
          url: finalUrl,
          rawUrl: up.url,
          ms: Date.now() - t0,
        };
      } catch (e) {
        return {
          target: spec.target,
          kieAr: spec.kieAr,
          error: e.message,
          ms: Date.now() - t0,
        };
      }
    }));

    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
