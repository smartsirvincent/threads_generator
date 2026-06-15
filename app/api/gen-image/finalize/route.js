// Step 3/3: download from KIE temp URL → upload to Cloudinary → return permanent URL
// (~5-10s, well under 60s)
import { NextResponse } from 'next/server';
import { downloadImage } from '@/lib/kie-image.js';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sanitize(s) {
  return String(s || 'untitled').replace(/[^\w\-]/g, '_').slice(0, 40);
}

export async function POST(req) {
  try {
    const { kieUrl, brand = '' } = await req.json();
    if (!kieUrl) {
      return NextResponse.json({ error: 'kieUrl required' }, { status: 400 });
    }

    let finalUrl = kieUrl;
    let cloudinaryPublicId = null;

    if (hasCloudinary()) {
      try {
        const buf = await downloadImage(kieUrl);
        const up = await uploadToCloudinary(buf, {
          folder: `threads-generator/${sanitize(brand)}`,
        });
        finalUrl = up.url;
        cloudinaryPublicId = up.publicId;
      } catch (e) {
        // 退回 KIE 暫存 URL (20 分鐘有效),比沒有好
      }
    }

    return NextResponse.json({ url: finalUrl, cloudinaryPublicId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
