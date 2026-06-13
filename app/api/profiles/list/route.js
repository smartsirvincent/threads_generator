// 列出 Cloudinary 上的所有 profile
import { NextResponse } from 'next/server';
import { listRawResources, hasAdminCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try {
    if (!hasAdminCloudinary()) {
      return NextResponse.json({ error: 'Cloudinary admin API 未設定 (需 api_key + secret)' }, { status: 503 });
    }
    const resources = await listRawResources({
      prefix: 'threads-generator/profiles/',
      maxResults: 100,
    });

    const profiles = resources.map((r) => {
      const tail = r.public_id.split('/').pop() || '';
      // 拆 name--hash
      const sepIdx = tail.lastIndexOf('--');
      const name = sepIdx > 0 ? tail.slice(0, sepIdx) : tail;
      return {
        publicId: r.public_id,
        url: r.secure_url,
        name,
        bytes: r.bytes,
        createdAt: r.created_at,
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ profiles }, {
      headers: { 'cache-control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
