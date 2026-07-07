// 素材產生器:用 KIE 並行生 3 張不同尺寸的素材
// KIE V2 原生支援 1:1 / 9:16 / 16:9;1.91:1 用 16:9 + Cloudinary 微裁切
import { NextResponse } from 'next/server';
import { submitImageV2, pollImageV2, downloadImage } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';
import { isMedical, MEDICAL_AESTHETIC_STYLE, MEDICAL_DEFAULT_PERSON, MEDICAL_PROMO_STYLE, clinicContextText } from '@/lib/verticals.js';

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

// ====================================================================
// 醫美 (medical aesthetics) 專用生圖 prompt
// 差異:主體是「療程/膚況」而非實體包裝;參考圖為選填;視覺走水光肌+溫暖診所信任感。
// 若 referenceIsProduct=true (例:德國天使肉毒包瓶、儀器) 才套用嚴格保留原貌規則。
// ====================================================================
function buildMedicalPrompt({
  product, title, subtitle, copyShort, copyLong, brand, brand_persona,
  useLogo, hasCompositionRef, textMode,
  includePerson, personDescription, compositionPrompt,
  hasReference, referenceIsProduct, clinic,
  materialType, scenePrompt,
}) {
  const parts = [];
  const isPromo = materialType === 'promo';

  const treatment = product?.name ? `the aesthetic-medicine treatment / skin outcome "${product.name}"` : 'an aesthetic-medicine skin outcome';
  parts.push(`Create a high-end medical-aesthetics (醫美) ${isPromo ? 'promotional / direct-response' : 'brand-image'} social ad visual for ${treatment}.`);
  if (product?.features) parts.push(`Treatment context (for mood, do NOT render as text): ${product.features.slice(0, 220)}`);
  if (product?.image_focus) parts.push(`Visual emphasis: ${product.image_focus}`);
  if (product?.promo_offer) parts.push(`Promotional context (only render if it appears in the allowed text list below): ${product.promo_offer}`);

  // 醫美視覺基調
  parts.push(MEDICAL_AESTHETIC_STYLE);
  if (isPromo) parts.push(MEDICAL_PROMO_STYLE);

  // 指定情景 (scene)
  const scene = (scenePrompt || '').trim();
  if (scene) parts.push(`SCENE / SETTING: ${scene}`);

  // 文字渲染 (沿用嚴格的 only-this-text 邏輯)
  parts.push(...buildTextRenderInstructions({ textMode, title, subtitle, copyShort, copyLong }));

  if (brand) parts.push(`Clinic brand vibe: ${brand}.`);
  if (brand_persona) parts.push(`Brand personality: ${brand_persona.slice(0, 60)}.`);

  // 診所信任感 (環境暗示,不寫成字)
  const clinicText = clinicContextText(clinic);
  if (clinicText) {
    parts.push(`Clinic trust cues to imply through the SETTING and mood only (never printed as on-image text): a legitimate, warm, professional Bangkok skin clinic — clean modern treatment room or cozy consultation lounge, soft warm lighting, feeling of being safely cared for by real doctors. Reference facts: ${clinicText.replace(/\n/g, ' / ').slice(0, 300)}`);
  }

  // 人物:醫美主體大多是人;預設帶入透亮膚況女性
  if (includePerson) {
    const desc = (personDescription || '').trim() || MEDICAL_DEFAULT_PERSON;
    parts.push(`Feature a person as the hero: ${desc}. Focus on realistic, radiant, healthy skin with natural texture (visible pores kept, no plastic over-smoothing). Natural, confident, relaxed expression. This is beauty/skincare photography, tasteful and elegant.`);
  } else {
    parts.push('No human figure required — build a still-life / environment composition (e.g. elegant clinic corner, skincare-adjacent props, soft fabric, marble, flowers) that conveys the treatment benefit abstractly.');
  }

  // 構圖描述
  const compHint = (compositionPrompt || '').trim();
  if (hasCompositionRef && compHint) {
    parts.push(`Composition guidance (mirror FRAMING / ANGLE / LAYOUT only, not specific content): ${compHint}`);
  }

  // 參考圖角色說明
  const refRoles = [];
  if (hasReference) refRoles.push(referenceIsProduct
    ? '[product/device/vial appearance source]'
    : '[subject or mood reference — a face, skin, model or scene to take inspiration from, NOT to copy exactly]');
  if (useLogo) refRoles.push('[clinic logo to include subtly]');
  if (hasCompositionRef) refRoles.push('[composition / layout inspiration]');
  if (refRoles.length) {
    parts.push(`Reference images in order: ${refRoles.map((r, i) => `[${i + 1}] ${r.slice(1, -1)}`).join(', ')}.`);
  }

  if (useLogo) {
    parts.push('Include the clinic logo subtly in a corner. Do not distort or invent variations of the logo.');
  } else {
    parts.push('STRICT: NO clinic name, NO brand name as invented text, NO fake certification badges, NO invented logos anywhere in the image.');
  }

  // 只有「參考圖確實是實體品牌產品」時,才套用嚴格保留原貌 (呼應包裝忠實原則)
  if (hasReference && referenceIsProduct) {
    parts.push('CRITICAL PRODUCT FIDELITY: The reference is a real physical product (vial / box / device). Preserve its EXACT original colors, shape, packaging design, label artwork, and any printed logos or text. Do NOT recolor, redesign, relabel, or invent packaging variants — it must look identical to the reference. This overrides other creative direction.');
  } else if (hasReference) {
    parts.push('The reference image is only a SUBJECT / MOOD inspiration (a face, skin or scene). Do NOT copy it exactly and do NOT reproduce any real person\'s identity — create a fresh, original beauty composition inspired by its vibe.');
  }

  parts.push('Photorealistic, high-quality, editorial beauty-ad grade, social-media ready, conversion-focused but tasteful and compliant.');
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
      // 產業別 + 醫美專用
      industry = 'general',
      clinic = null,
      referenceIsProduct = false,
      materialType = 'brand', // 'brand' | 'promo'
      scenePrompt = '',
      ratios, // 選填:要生哪些比例,例 ['1:1'];沒給則全部 3 種
    } = await req.json();

    // 只生指定比例 (預設全部)。減少單次請求工作量,避免 Vercel timeout(504)
    const wanted = Array.isArray(ratios) && ratios.length > 0 ? ratios : null;
    const sizeMap = wanted ? SIZE_MAP.filter((s) => wanted.includes(s.target)) : SIZE_MAP;
    const activeSizeMap = sizeMap.length > 0 ? sizeMap : [SIZE_MAP[0]];

    const medical = isMedical(industry);
    const hasReference = !!(refUrl && typeof refUrl === 'string');

    // 醫美療程大多沒有實體包裝,參考圖為選填;一般模式仍要求要有參考圖
    if (!medical && !hasReference) {
      return NextResponse.json({ error: 'refUrl required' }, { status: 400 });
    }

    const mode = TEXT_MODES.has(textMode) ? textMode : 'title_sub';

    const inputUrls = [];
    if (hasReference) inputUrls.push(refUrl);
    if (useLogo && logoUrl) inputUrls.push(logoUrl);
    if (compositionRefUrl) inputUrls.push(compositionRefUrl);

    let basePrompt;
    if (product && medical) {
      basePrompt = buildMedicalPrompt({
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
        hasReference,
        referenceIsProduct: !!referenceIsProduct,
        clinic,
        materialType: materialType === 'promo' ? 'promo' : 'brand',
        scenePrompt,
      });
    } else if (product) {
      basePrompt = buildProductPrompt({
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
      });
    } else {
      basePrompt = STYLE_PROMPT;
    }
    const prompt = extraPrompt ? `${basePrompt}\n\nExtra direction: ${extraPrompt}` : basePrompt;

    const results = await Promise.all(activeSizeMap.map(async (spec) => {
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
