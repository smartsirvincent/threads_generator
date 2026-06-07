// Chunked: 單張圖片生成 + 上傳 Cloudinary
// 平均 30-50 秒/張,Hobby 60s 內可完成
import { NextResponse } from 'next/server';
import { generateAndDownload } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { prompt, referenceImages = [], size = '1:1', brand = '', themeName = '' } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }

    const t0 = Date.now();
    const kie = await generateAndDownload({ prompt, referenceImages, size });
    const kieMs = Date.now() - t0;

    let finalUrl = kie.kieUrl;
    let cloudinaryPublicId = null;
    if (hasCloudinary() && kie.buffer) {
      try {
        const up = await uploadToCloudinary(kie.buffer, {
          folder: `threads-generator/${sanitize(brand)}`,
        });
        finalUrl = up.url;
        cloudinaryPublicId = up.publicId;
      } catch (e) {
        // 退回到 KIE URL (20 分鐘有效,但比沒有好)
      }
    }

    return NextResponse.json({
      url: finalUrl,
      kieTaskId: kie.taskId,
      cloudinaryPublicId,
      kieMs,
      themeName,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function sanitize(s) {
  return String(s || 'untitled').replace(/[^\w\-]/g, '_').slice(0, 40);
}
