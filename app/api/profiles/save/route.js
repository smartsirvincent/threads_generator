// 雲端儲存 profile 到 Cloudinary raw
// 改成覆蓋模式:同名直接覆蓋,不再每次產生新檔
import { NextResponse } from 'next/server';
import { uploadRawToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: 'Cloudinary 未設定,無法雲端儲存' }, { status: 503 });
    }
    const { name, profile } = await req.json();
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name required' }, { status: 400 });
    }
    if (!profile || typeof profile !== 'object') {
      return NextResponse.json({ error: 'profile object required' }, { status: 400 });
    }

    const safeName = sanitizeName(name);
    // 同名直接覆蓋:publicId 不帶 hash 後綴
    const publicId = `threads-generator/profiles/${safeName}`;

    const json = JSON.stringify({
      name,
      profile,
      savedAt: Date.now(),
    }, null, 2);
    const buffer = Buffer.from(json, 'utf-8');

    const up = await uploadRawToCloudinary(buffer, {
      publicId,
      filename: `${safeName}.json`,
      overwrite: true, // 同名直接覆蓋,不會 fail "Asset already exists"
    });

    return NextResponse.json({
      url: up.url,
      publicId: up.publicId,
      name,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function sanitizeName(s) {
  // 保留中文 + 英數,其他轉 _
  return String(s).replace(/[^\w一-龥\-]/g, '_').slice(0, 40) || 'profile';
}
