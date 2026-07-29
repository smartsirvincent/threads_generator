// 醫美素材 chunked 生圖 — Step 1/3: 組 prompt + KIE submit,回 taskId (~2-3s)
// 之後由 client 輪詢 /api/gen-image/poll,再打 /api/material/gen-image/finalize
import { NextResponse } from 'next/server';
import { submitImageV2 } from '@/lib/kie-image.js';
import { hasCloudinary } from '@/lib/cloudinary.js';
import {
  TEXT_MODES, sizeSpec, buildMedicalPrompt, resolveMaterialInputUrls,
} from '@/lib/material-prompt.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: '雲端儲存未設定' }, { status: 503 });
    }
    const b = await req.json();
    const {
      product, title, subtitle, copy, copyShort, copyLong,
      brand, brand_persona,
      refUrl, logoUrl, useLogo, compositionRefUrl,
      textMode = 'title_sub', includePerson = false, personDescription = '', compositionPrompt = '',
      clinic = null, referenceIsProduct = false, materialType = 'brand', scenePrompt = '',
      ratio = '1:1',
    } = b;

    const spec = sizeSpec(ratio);
    const mode = TEXT_MODES.has(textMode) ? textMode : 'title_sub';
    const hasReference = !!(refUrl && typeof refUrl === 'string');

    const prompt = buildMedicalPrompt({
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

    const referenceImages = resolveMaterialInputUrls({ refUrl, useLogo, logoUrl, compositionRefUrl });
    const taskId = await submitImageV2({ prompt, referenceImages, aspect_ratio: spec.kieAr });

    return NextResponse.json({
      taskId,
      target: spec.target,
      kieAr: spec.kieAr,
      cloudinaryAr: spec.cloudinaryAr,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
