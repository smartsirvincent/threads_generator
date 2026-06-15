// 素材產生器:用 KIE 並行生 3 張不同尺寸的素材
// KIE V2 原生支援 1:1 / 9:16 / 16:9;1.91:1 用 16:9 + Cloudinary 微裁切
import { NextResponse } from 'next/server';
import { submitImageV2, pollImageV2, downloadImage } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const STYLE_PROMPT = 'Create a new original image inspired by the visual style of the reference. Photorealistic, high quality, social media ready.';

const TEXT_MODES = new Set(['none', 'title_sub', 'short', 'long']);

/**
 * textMode:
 *   'none'      → 圖中完全無文字
 *   'title_sub' → 圖中只有主標 + 副標
 *   'short'     → 主標 + 副標 + 短版文案 (圖中)
 *   'long'      → 主標 + 副標 + 長版文案 (文字較重的廣告版型)
 *
 * 每種模式都嚴格 only-this-text:除了指定文字之外不可有任何其他字、標籤、徽章、價格牌、浮水印
 */
function buildTextRenderInstructions({ textMode, title, subtitle, copyShort, copyLong }) {
  const parts = [];

  if (textMode === 'none') {
    parts.push('TEXT RENDERING — ABSOLUTELY STRICT: Do NOT render ANY visible text whatsoever in the image. NO headline, NO subhead, NO body copy, NO product labels printed on background, NO watermarks, NO logos, NO badges, NO price tags, NO hashtags, NO captions, NO signage in scene. Pure visual composition with zero typography. This rule overrides any other instruction.');
    return parts;
  }

  // 收集允許出現的文字內容
  const allowedTexts = [];

  if (title) {
    parts.push(`TEXT TO RENDER (1) — MAIN HEADLINE: "${title}". Render as bold, legible, typographically integrated overlay within the composition. This is the dominant text.`);
    allowedTexts.push(`"${title}"`);
  }
  if (subtitle) {
    parts.push(`TEXT TO RENDER (2) — SUBHEADLINE: "${subtitle}". Smaller than headline but still readable.`);
    allowedTexts.push(`"${subtitle}"`);
  }
  if (textMode === 'short' && copyShort) {
    parts.push(`TEXT TO RENDER (3) — SHORT BODY COPY: "${copyShort}". Small clean text block, 1-2 lines, supporting the headline.`);
    allowedTexts.push(`"${copyShort}"`);
  }
  if (textMode === 'long' && copyLong) {
    parts.push(`TEXT TO RENDER (3) — FULL BODY COPY: "${copyLong}". Multi-line text block, text-heavy ad layout style, clear typographic hierarchy.`);
    allowedTexts.push(`"${copyLong}"`);
  }

  // 加超強約束:除了允許清單之外的字一個都不可以出現
  const modeLabel = {
    title_sub: 'ONLY the main headline and subheadline above',
    short: 'ONLY the main headline, subheadline, and short body copy above',
    long: 'ONLY the main headline, subheadline, and full body copy above',
  }[textMode] || 'ONLY the texts listed above';

  parts.push(`TEXT RENDERING — STRICT EXCLUSIVITY: The image must contain ${modeLabel} — these EXACT strings, NOTHING ELSE. Specifically FORBIDDEN: do NOT add any extra captions, do NOT invent additional taglines, do NOT add hashtags, do NOT add price tags or discount badges (unless they ARE the listed text), do NOT add promotional stickers, do NOT add watermarks, do NOT render brand names as separate text, do NOT add decorative signage in the scene, do NOT show packaging label text beyond what is already printed on the reference product. The allowed text strings are: ${allowedTexts.join(' | ')}. Anything beyond this list is a VIOLATION.`);

  return parts;
}

function buildProductPrompt({
  product, title, subtitle, copyShort, copyLong, brand, brand_persona,
  useLogo, hasCompositionRef, textMode,
  includePerson, personDescription, compositionPrompt,
}) {
  if (!product) return STYLE_PROMPT;
  const parts = [];

  parts.push(`Create a high-quality social media visual featuring the product: "${product.name}".`);
  if (product.features) parts.push(`Product key traits: ${product.features.slice(0, 200)}`);
  if (product.image_focus) parts.push(`Visual emphasis: ${product.image_focus}`);
  if (product.promo_offer) parts.push(`Promotional context: ${product.promo_offer}`);

  // 文字渲染指令
  parts.push(...buildTextRenderInstructions({ textMode, title, subtitle, copyShort, copyLong }));

  if (brand) parts.push(`Brand: ${brand}.`);
  if (brand_persona) parts.push(`Brand vibe: ${brand_persona.slice(0, 60)}.`);

  // 人物
  if (includePerson) {
    const desc = (personDescription || '').trim();
    if (desc) {
      parts.push(`Include a person in the composition: ${desc}. The person should feel natural and integrated with the product.`);
    } else {
      parts.push('Include a person in the composition, naturally interacting with the product.');
    }
  } else {
    parts.push('Do NOT include any people in the image. Product-focused only, no human figures, no hands, no body parts.');
  }

  // 構圖描述 (from vision analysis)
  const compHint = (compositionPrompt || '').trim();
  if (hasCompositionRef && compHint) {
    parts.push(`Composition guidance (mirror the FRAMING / ANGLE / LAYOUT only, not the specific content): ${compHint}`);
  }

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

  // ===== 嚴格保留產品原貌 =====
  parts.push('CRITICAL PRODUCT FIDELITY: Preserve the EXACT original colors, shape, packaging design, label artwork, and any visible logos or text printed ON the product itself. Do NOT recolor the product. Do NOT alter, hallucinate, or remove any branding, labels, or product markings. The product must look identical to the reference, only the background/composition/style around it should change.');

  // ===== 絕對禁止新包裝 (hard rule) =====
  parts.push('ABSOLUTELY FORBIDDEN — HARD RULE: Under NO circumstances may you invent, redesign, replace, modify, or stylize the product packaging. The packaging in the output image MUST be pixel-faithful to the reference. Do NOT create new packaging variants. Do NOT redraw labels. Do NOT swap container shapes. If you cannot keep the packaging identical, output the product as-is from the reference rather than imagining a new one. This rule overrides any other creative direction.');

  parts.push('Photorealistic, high quality, social media ready, vibrant lighting, conversion-focused composition.');
  return parts.join(' ');
}

const SIZE_MAP = [
  { target: '1:1', kieAr: '1:1', cloudinaryAr: null },
  { target: '9:16', kieAr: '9:16', cloudinaryAr: null },
  { target: '1.91:1', kieAr: '16:9', cloudinaryAr: '191:100' },
];

function applyCloudinaryAspect(url, ar) {
  if (!ar) return url;
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
      copyShort,
      copyLong,
      copy, // legacy / fallback
      brand,
      brand_persona,
      logoUrl,
      useLogo,
      compositionRefUrl,
      // 新欄位
      textMode = 'title_sub', // 'none' | 'title_sub' | 'short' | 'long'
      includePerson = false,
      personDescription = '',
      compositionPrompt = '',
    } = await req.json();

    if (!refUrl || typeof refUrl !== 'string') {
      return NextResponse.json({ error: 'refUrl required' }, { status: 400 });
    }

    const mode = TEXT_MODES.has(textMode) ? textMode : 'title_sub';

    const inputUrls = [refUrl];
    if (useLogo && logoUrl) inputUrls.push(logoUrl);
    if (compositionRefUrl) inputUrls.push(compositionRefUrl);

    const basePrompt = product
      ? buildProductPrompt({
          product, title, subtitle,
          copyShort: copyShort || copy || '',
          copyLong: copyLong || copy || '',
          brand, brand_persona,
          useLogo: !!(useLogo && logoUrl),
          hasCompositionRef: !!compositionRefUrl,
          textMode: mode,
          includePerson: !!includePerson,
          personDescription,
          compositionPrompt,
        })
      : STYLE_PROMPT;
    const prompt = extraPrompt ? `${basePrompt}\n\nExtra direction: ${extraPrompt}` : basePrompt;

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
