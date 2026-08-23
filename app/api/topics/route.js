// 主題庫:存/讀「已確認的發文主題」(含可編輯的提示詞)。存 Cloudinary 固定槽,跨裝置一致。
import { NextResponse } from 'next/server';
import { uploadRawToCloudinary, listRawResources, hasCloudinary, hasAdminCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PUBLIC_ID = 'threads-generator/topics/best-friend';
const PREFIX = 'threads-generator/topics/';

export async function GET() {
  try {
    if (!hasAdminCloudinary()) return NextResponse.json({ topics: [] });
    const list = await listRawResources({ prefix: PREFIX });
    const match = list.find((r) => (r.public_id || '').includes('best-friend'));
    if (!match?.secure_url) return NextResponse.json({ topics: [] });
    const r = await fetch(match.secure_url, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ topics: [] });
    const data = await r.json();
    return NextResponse.json({ topics: Array.isArray(data.topics) ? data.topics : [] });
  } catch (e) {
    return NextResponse.json({ topics: [], error: e.message });
  }
}

export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: 'Cloudinary 未設定,無法存主題庫' }, { status: 503 });
    }
    const { topics } = await req.json();
    if (!Array.isArray(topics)) {
      return NextResponse.json({ error: 'topics 必須是陣列' }, { status: 400 });
    }
    const clean = topics
      .filter((t) => t && t.name)
      .map((t) => ({
        id: String(t.id || `${Date.now()}-${Math.round(Math.random() * 1e6)}`),
        type: ['text', 'long', 'image'].includes(t.type) ? t.type : 'text',
        name: String(t.name).slice(0, 80),
        prompt: String(t.prompt || '').slice(0, 2000),
        imagePrompt: String(t.imagePrompt || '').slice(0, 2000),
        useLogo: !!t.useLogo,
        treatments: Array.isArray(t.treatments) ? t.treatments.filter(Boolean).map(String).slice(0, 30) : [],
        mix: t.mix === 'weight' ? 'weight' : 'rotate',
        weights: (t.weights && typeof t.weights === 'object') ? t.weights : {},
        inject: {
          name: t.inject?.name !== false,
          price: t.inject?.price !== false,
          imageFocus: t.inject?.imageFocus !== false,
        },
        enabled: t.enabled !== false,
      }));
    const buffer = Buffer.from(JSON.stringify({ topics: clean, savedAt: Date.now() }, null, 2), 'utf-8');
    await uploadRawToCloudinary(buffer, { publicId: PUBLIC_ID, filename: 'topics.json', overwrite: true });
    return NextResponse.json({ ok: true, count: clean.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
