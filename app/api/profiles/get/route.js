// 讀取「固定槽」品牌設定 (跨裝置一致):依名稱從 Cloudinary raw 找出對應 profile
import { NextResponse } from 'next/server';
import { listRawResources, hasAdminCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

function sanitizeName(s) {
  return String(s).replace(/[^\w一-龥\-]/g, '_').slice(0, 40) || 'profile';
}

export async function GET(req) {
  try {
    if (!hasAdminCloudinary()) {
      return NextResponse.json({ profile: null, reason: 'no-cloudinary' });
    }
    const url = new URL(req.url);
    const name = url.searchParams.get('name') || '';
    if (!name) return NextResponse.json({ profile: null, reason: 'no-name' });

    const safe = sanitizeName(name);
    const list = await listRawResources({ prefix: 'threads-generator/profiles/' });
    // public_id 例:threads-generator/profiles/泰國醫美_Best_Friend.json
    const match = list.find((r) => (r.public_id || '').includes(safe));
    if (!match?.secure_url) {
      return NextResponse.json({ profile: null, reason: 'not-found' });
    }
    const r = await fetch(match.secure_url, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ profile: null, reason: `fetch-${r.status}` });
    const wrapper = await r.json();
    return NextResponse.json({ profile: wrapper.profile || wrapper, name });
  } catch (e) {
    return NextResponse.json({ profile: null, error: e.message });
  }
}
