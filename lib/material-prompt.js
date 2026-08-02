// 醫美素材生圖 prompt 共用模組 (給 chunked submit 用)
// 與 app/api/material/generate/route.js 的邏輯一致,抽出來讓 submit 端重用。
import { MEDICAL_AESTHETIC_STYLE, MEDICAL_DEFAULT_PERSON, MEDICAL_PROMO_STYLE, clinicContextText } from '@/lib/verticals.js';

export const TEXT_MODES = new Set(['none', 'title_sub', 'short', 'long']);

// 1:1 原生;1.91:1 用 16:9 + Cloudinary 微裁切
export const SIZE_MAP = [
  { target: '1:1', kieAr: '1:1', cloudinaryAr: null },
  { target: '9:16', kieAr: '9:16', cloudinaryAr: null },
  { target: '1.91:1', kieAr: '16:9', cloudinaryAr: '191:100' },
];

export function sizeSpec(target) {
  return SIZE_MAP.find((s) => s.target === target) || SIZE_MAP[0];
}

export function applyCloudinaryAspect(url, ar) {
  if (!ar || !url) return url;
  return url.replace('/image/upload/', `/image/upload/c_fill,g_auto,ar_${ar},w_1080/`);
}

function buildTextRenderInstructions({ textMode, title, subtitle, copyShort, copyLong }) {
  const parts = [];
  if (textMode === 'none') {
    parts.push('TEXT RENDERING — ABSOLUTELY STRICT: Do NOT render ANY visible text whatsoever in the image. NO headline, NO subhead, NO body copy, NO product labels printed on background, NO watermarks, NO logos, NO badges, NO price tags, NO hashtags, NO captions, NO signage in scene. Pure visual composition with zero typography. This rule overrides any other instruction.');
    return parts;
  }
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
  const modeLabel = {
    title_sub: 'ONLY the main headline and subheadline above',
    short: 'ONLY the main headline, subheadline, and short body copy above',
    long: 'ONLY the main headline, subheadline, and full body copy above',
  }[textMode] || 'ONLY the texts listed above';
  parts.push(`TEXT RENDERING — STRICT EXCLUSIVITY: The image must contain ${modeLabel} — these EXACT strings, NOTHING ELSE. Specifically FORBIDDEN: do NOT add any extra captions, do NOT invent additional taglines, do NOT add hashtags, do NOT add price tags or discount badges (unless they ARE the listed text), do NOT add promotional stickers, do NOT add watermarks, do NOT render brand names as separate text, do NOT add decorative signage in the scene. The allowed text strings are: ${allowedTexts.join(' | ')}. Anything beyond this list is a VIOLATION.`);
  return parts;
}

// 醫美生圖 prompt
export function buildMedicalPrompt({
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

  parts.push(MEDICAL_AESTHETIC_STYLE);
  if (isPromo) parts.push(MEDICAL_PROMO_STYLE);

  const scene = (scenePrompt || '').trim();
  if (scene) parts.push(`SCENE / SETTING: ${scene}`);

  parts.push(...buildTextRenderInstructions({ textMode, title, subtitle, copyShort, copyLong }));

  if (brand) parts.push(`Clinic brand vibe: ${brand}.`);
  if (brand_persona) parts.push(`Brand personality: ${brand_persona.slice(0, 60)}.`);

  const clinicText = clinicContextText(clinic);
  if (clinicText) {
    parts.push(`Clinic trust cues to imply through the SETTING and mood only (never printed as on-image text): a legitimate, warm, professional Bangkok skin clinic — clean modern treatment room or cozy consultation lounge, soft warm lighting, feeling of being safely cared for by real doctors. Reference facts: ${clinicText.replace(/\n/g, ' / ').slice(0, 300)}`);
  }

  // 一律以「美麗東方女性」為主體 (不論 includePerson);療程名稱/特點/價格用文字呈現
  const desc = (personDescription || '').trim() || MEDICAL_DEFAULT_PERSON;
  parts.push(`HERO SUBJECT = a beautiful East-Asian woman, front and center as the main focus: ${desc}. Realistic, radiant, healthy glowing skin with natural texture (keep visible pores, no plastic over-smoothing), elegant and confident. Beauty/skincare editorial photography.`);
  parts.push('ABSOLUTELY NO PRODUCTS OR DEVICES: do NOT show any bottle, vial, ampoule, syringe, needle, tube, jar, box, packaging, medical device, machine, laser handpiece, ultrasound/RF applicator, equipment or any treatment apparatus/instrument (儀器) anywhere in the image. The image is ONLY the woman + a soft tasteful background + clean typography. No injection or procedure being performed on screen.');

  const compHint = (compositionPrompt || '').trim();
  if (hasCompositionRef && compHint) {
    parts.push(`Composition guidance (mirror FRAMING / ANGLE / LAYOUT only, not specific content): ${compHint}`);
  }

  const refRoles = [];
  if (hasReference) refRoles.push('subject or mood reference — a face / skin / model / scene to take inspiration from, NOT to copy exactly (never treat it as a product to reproduce)');
  if (useLogo) refRoles.push('clinic logo to include subtly');
  if (hasCompositionRef) refRoles.push('composition / layout inspiration');
  if (refRoles.length) {
    parts.push(`Reference images in order: ${refRoles.map((r, i) => `[${i + 1}] ${r}`).join(', ')}.`);
  }

  if (useLogo) {
    parts.push('MUST include the clinic logo, placed subtly in a corner of the image. Do not distort, recolor or invent variations of the logo.');
  } else {
    parts.push('STRICT: NO clinic name, NO brand name as invented text, NO fake certification badges, NO invented logos anywhere in the image.');
  }

  if (hasReference) {
    parts.push('The reference image is only a SUBJECT / MOOD inspiration (a face, skin or scene). Do NOT copy it exactly and do NOT reproduce any real person\'s identity — create a fresh, original beauty composition inspired by its vibe.');
  }

  parts.push('Photorealistic, high-quality, editorial beauty-ad grade, social-media ready, conversion-focused but tasteful and compliant.');
  return parts.join(' ');
}

// 依 material 參數組出參考圖 URL 陣列 (順序需與 prompt 描述一致)
export function resolveMaterialInputUrls({ refUrl, useLogo, logoUrl, compositionRefUrl }) {
  const urls = [];
  if (refUrl && typeof refUrl === 'string') urls.push(refUrl);
  if (useLogo && logoUrl) urls.push(logoUrl);
  if (compositionRefUrl) urls.push(compositionRefUrl);
  return urls;
}
