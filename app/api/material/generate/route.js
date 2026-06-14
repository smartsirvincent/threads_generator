// 素材產生器:用 KIE 並行生 3 張不同尺寸的素材
// KIE 原生只支援 1:1 / 3:2 / 2:3,9:16 和 1.91:1 用 Cloudinary 轉換裁切
import { NextResponse } from 'next/server';
import { submitImage, pollImage, downloadImage } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const STYLE_PROMPT = 'Create a new original image inspired by the visual style of the reference. Maintain the color palette, lighting, mood, composition style, depth of field, and overall aesthetic. Do NOT replicate exact content or specific objects from the reference. Photorealistic, high quality, social media ready.';

// target: 用戶看到的尺寸名;kieSize: 餵 KIE 的最接近原生尺寸;cloudinaryAr: 套 Cloudinary 裁切到精確比例
const SIZE_MAP = [
  { target: '1:1', kieSize: '1:1', cloudinaryAr: null },              // 1:1 直接用 KIE,不裁切
  { target: '9:16', kieSize: '2:3', cloudinaryAr: '9:16' },           // 2:3 (0.667) → 9:16 (0.5625) 裁兩側
  { target: '1.91:1', kieSize: '3:2', cloudinaryAr: '191:100' },      // 3:2 (1.5) → 1.91 (1.91) 裁上下
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
    const { refUrl, extraPrompt } = await req.json();
    if (!refUrl || typeof refUrl !== 'string') {
      return NextResponse.json({ error: 'refUrl required' }, { status: 400 });
    }

    const prompt = extraPrompt ? `${STYLE_PROMPT}\n\nExtra direction: ${extraPrompt}` : STYLE_PROMPT;

    // 並行 3 個 KIE call
    const results = await Promise.all(SIZE_MAP.map(async (spec) => {
      const t0 = Date.now();
      try {
        const taskId = await submitImage({
          prompt,
          referenceImages: [refUrl],
          size: spec.kieSize,
        });
        const kieUrl = await pollImage(taskId);
        const buffer = await downloadImage(kieUrl);
        const up = await uploadToCloudinary(buffer, { folder: 'material/results' });
        const finalUrl = applyCloudinaryAspect(up.url, spec.cloudinaryAr);
        return {
          target: spec.target,
          kieSize: spec.kieSize,
          url: finalUrl,
          rawUrl: up.url,
          ms: Date.now() - t0,
        };
      } catch (e) {
        return {
          target: spec.target,
          kieSize: spec.kieSize,
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
