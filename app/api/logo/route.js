// 把品牌 LOGO(可能是外部 URL,如 i.ibb.co)轉存到 Cloudinary,回傳 Cloudinary URL。
// 疊 LOGO 用 l_<publicId> 才穩;外部 URL 走 l_fetch 常被 Cloudinary 擋 → 整張圖壞掉。
import { NextResponse } from 'next/server';
import { uploadToCloudinary, hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
    // 已經是 Cloudinary 就直接用
    if (/res\.cloudinary\.com\//.test(url)) return NextResponse.json({ url });
    if (!hasCloudinary()) return NextResponse.json({ url }); // 沒設定就原樣退回
    // Cloudinary 支援直接吃遠端 URL 當來源
    const up = await uploadToCloudinary(url, { folder: 'threads-generator/logos' });
    return NextResponse.json({ url: up.url, publicId: up.publicId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
