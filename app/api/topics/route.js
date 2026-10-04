// 主題庫:存/讀「已確認的發文主題」(含可編輯的提示詞)。存 Cloudinary 固定槽,跨裝置一致。
import { NextResponse } from 'next/server';
import { uploadRawToCloudinary, listRawResources, hasCloudinary, hasAdminCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PUBLIC_ID = 'threads-generator/topics/best-friend';
const PREFIX = 'threads-generator/topics/';

// 讀雲端目前的主題(POST 合併時也用,確保拿最新版)
async function readTopics() {
  if (!hasAdminCloudinary()) return [];
  const list = await listRawResources({ prefix: PREFIX });
  const match = list.find((r) => (r.public_id || '').includes('best-friend'));
  if (!match?.secure_url) return [];
  const r = await fetch(match.secure_url, { cache: 'no-store' });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data.topics) ? data.topics : [];
}

function normalize(t) {
  return {
    id: String(t.id || `${Date.now()}-${Math.round(Math.random() * 1e6)}`),
    type: ['text', 'long', 'image'].includes(t.type) ? t.type : 'text',
    name: String(t.name).slice(0, 80),
    prompt: String(t.prompt || '').slice(0, 2000),
    imagePrompt: String(t.imagePrompt || '').slice(0, 2000),
    useLogo: !!t.useLogo,
    culture: !!t.culture,
    varLabel: String(t.varLabel || '').slice(0, 20),
    variables: Array.isArray(t.variables) ? t.variables.filter(Boolean).map((v) => String(v).slice(0, 40)).slice(0, 50) : [],
    varOptions: Array.isArray(t.varOptions) ? t.varOptions.filter((o) => o && o.label).slice(0, 5).map((o) => ({
      label: String(o.label).slice(0, 20),
      values: Array.isArray(o.values) ? o.values.filter(Boolean).map((v) => String(v).slice(0, 40)).slice(0, 20) : [],
    })) : [],
    activeDims: Array.isArray(t.activeDims) ? t.activeDims.filter((o) => o && o.label && Array.isArray(o.values) && o.values.length).slice(0, 3).map((o) => ({
      label: String(o.label).slice(0, 20),
      values: o.values.filter(Boolean).map((v) => String(v).slice(0, 40)).slice(0, 20),
    })) : [],
    schedule: Array.isArray(t.schedule) ? t.schedule.filter((s) => s && Number.isInteger(s.weekday) && s.weekday >= 0 && s.weekday <= 6 && /^\d{2}:\d{2}$/.test(s.time || '')).slice(0, 30).map((s) => ({ weekday: s.weekday, time: s.time })) : [],
    treatments: Array.isArray(t.treatments) ? t.treatments.filter(Boolean).map(String).slice(0, 30) : [],
    starred: Array.isArray(t.starred) ? t.starred.filter(Boolean).map(String).slice(0, 30) : [],
    inject: {
      name: t.inject?.name !== false,
      price: t.inject?.price !== false,
      imageFocus: t.inject?.imageFocus !== false,
    },
    enabled: t.enabled !== false,
  };
}

export async function GET() {
  try {
    return NextResponse.json({ topics: await readTopics() });
  } catch (e) {
    return NextResponse.json({ topics: [], error: e.message });
  }
}

// POST 兩種用法:
//  1) { ops:[{id, fields, isNew?}], removes:[id] } —— 只合併改動的欄位到雲端最新版(建議;多分頁同時開也不會互蓋)
//  2) { topics:[...] } —— 整包覆蓋(舊用法,保留相容)
export async function POST(req) {
  try {
    if (!hasCloudinary()) {
      return NextResponse.json({ error: 'Cloudinary 未設定,無法存主題庫' }, { status: 503 });
    }
    const body = await req.json();
    let merged;
    if (Array.isArray(body.ops) || Array.isArray(body.removes)) {
      const cur = await readTopics();
      const removes = new Set((body.removes || []).map(String));
      let list = cur.filter((t) => !removes.has(String(t.id)));
      const fresh = [];
      for (const op of body.ops || []) {
        if (!op || !op.id || removes.has(String(op.id))) continue;
        const i = list.findIndex((t) => String(t.id) === String(op.id));
        if (i >= 0) list[i] = { ...list[i], ...(op.fields || {}) };
        else if (op.fields?.name || op.isNew) fresh.push({ id: op.id, ...(op.fields || {}) });
      }
      merged = [...fresh, ...list];
    } else if (Array.isArray(body.topics)) {
      merged = body.topics;
    } else {
      return NextResponse.json({ error: '需要 ops 或 topics' }, { status: 400 });
    }
    const clean = merged.filter((t) => t && t.name).map(normalize);
    const buffer = Buffer.from(JSON.stringify({ topics: clean, savedAt: Date.now() }, null, 2), 'utf-8');
    await uploadRawToCloudinary(buffer, { publicId: PUBLIC_ID, filename: 'topics.json', overwrite: true });
    return NextResponse.json({ ok: true, count: clean.length, topics: clean });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
