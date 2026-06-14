// 素材產生器:上傳用戶的參考圖到 Cloudinary,回傳公開 URL
// (KIE 需要 URL 才能當參考圖)
import { NextResponse } from 'next/server';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: '雲端儲存未設定' }, { status: 503 });
    }
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !file.arrayBuffer) {
      return NextResponse.json({ error: '請上傳圖片檔' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const up = await uploadToCloudinary(buffer, { folder: 'material/refs' });
    return NextResponse.json({ url: up.url, publicId: up.publicId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
