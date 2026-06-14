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
function buildProductPrompt({ product, title, subtitle, copy, brand, brand_persona, refMode }) {
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
  if (copy) {
    parts.push(`Mood reference (do not render as text): ${copy.slice(0, 100)}`);
  }
  if (brand) parts.push(`Brand: ${brand}.`);
  if (brand_persona) parts.push(`Brand vibe: ${brand_persona.slice(0, 60)}.`);

  if (refMode === 'product_only') {
    parts.push('Use the reference image as the product appearance source. Do not copy its background or composition — design a fresh layout.');
  } else if (refMode === 'style_ref') {
    parts.push('Use the reference image purely for visual style (color/lighting/mood). The product itself should be the main focus.');
  }

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
    const { refUrl, extraPrompt, product, title, subtitle, copy, brand, brand_persona, refMode } = await req.json();
    if (!refUrl || typeof refUrl !== 'string') {
      return NextResponse.json({ error: 'refUrl required' }, { status: 400 });
    }

    const basePrompt = product
      ? buildProductPrompt({ product, title, subtitle, copy, brand, brand_persona, refMode })
      : STYLE_PROMPT;
    const prompt = extraPrompt ? `${basePrompt}\n\nExtra direction: ${extraPrompt}` : basePrompt;

    // 並行 3 個 KIE V2 call (原生 aspect_ratio,不再走老 endpoint)
    const results = await Promise.all(SIZE_MAP.map(async (spec) => {
      const t0 = Date.now();
      try {
        const taskId = await submitImageV2({
          prompt,
          referenceImages: [refUrl],
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
