// 刪除一個雲端 profile
import { NextResponse } from 'next/server';
import { deleteRawResource, hasAdminCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    if (!hasAdminCloudinary()) {
      return NextResponse.json({ error: 'Cloudinary admin API 未設定' }, { status: 503 });
    }
    const { publicId } = await req.json();
    if (!publicId || typeof publicId !== 'string') {
      return NextResponse.json({ error: 'publicId required' }, { status: 400 });
    }
    if (!publicId.startsWith('threads-generator/profiles/')) {
      return NextResponse.json({ error: 'publicId 路徑不對' }, { status: 400 });
    }
    const result = await deleteRawResource(publicId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
