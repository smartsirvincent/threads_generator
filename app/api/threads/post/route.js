// 一鍵發到 Threads(官方 Graph API,兩步:建立容器 → 發佈)+ 依主題記錄發文 log(供成效分析)
// 需要環境變數:THREADS_USER_ID、THREADS_ACCESS_TOKEN(長期權杖)
import { NextResponse } from 'next/server';
import { uploadRawToCloudinary, listRawResources, hasCloudinary, hasAdminCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE = 'https://graph.threads.net/v1.0';
const LOG_PUBLIC_ID = 'threads-generator/postlog/best-friend';
const LOG_PREFIX = 'threads-generator/postlog/';

function creds() {
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  return { userId, token, ok: !!(userId && token) };
}

async function threadsPost(path, params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/${path}?${qs}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

async function readLog() {
  try {
    if (!hasAdminCloudinary()) return [];
    const list = await listRawResources({ prefix: LOG_PREFIX });
    const match = list.find((r) => (r.public_id || '').includes('best-friend'));
    if (!match?.secure_url) return [];
    const r = await fetch(match.secure_url, { cache: 'no-store' });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.entries) ? d.entries : [];
  } catch (_) { return []; }
}

async function appendLog(entry) {
  try {
    if (!hasCloudinary()) return;
    const entries = await readLog();
    entries.unshift(entry);
    const buffer = Buffer.from(JSON.stringify({ entries: entries.slice(0, 2000) }, null, 2), 'utf-8');
    await uploadRawToCloudinary(buffer, { publicId: LOG_PUBLIC_ID, filename: 'postlog.json', overwrite: true });
  } catch (_) { /* log 失敗不影響發文 */ }
}

export async function GET() {
  return NextResponse.json({ configured: creds().ok });
}

export async function POST(req) {
  try {
    const { userId, token, ok } = creds();
    if (!ok) {
      return NextResponse.json({
        error: 'Threads 尚未設定。請在 Vercel 環境變數加入 THREADS_USER_ID 與 THREADS_ACCESS_TOKEN。',
        configured: false,
      }, { status: 503 });
    }
    const { text, topicId = '', topicName = '', type = '' } = await req.json();
    const body = (text || '').trim();
    if (!body) return NextResponse.json({ error: '貼文內容不可空白' }, { status: 400 });
    if (body.length > 500) return NextResponse.json({ error: 'Threads 貼文上限 500 字' }, { status: 400 });

    const created = await threadsPost(`${userId}/threads`, { media_type: 'TEXT', text: body, access_token: token });
    const creationId = created.id;
    if (!creationId) throw new Error('建立容器失敗:沒有回傳 id');

    const published = await threadsPost(`${userId}/threads_publish`, { creation_id: creationId, access_token: token });
    const mediaId = published.id;

    let permalink = '';
    try {
      const qs = new URLSearchParams({ fields: 'permalink', access_token: token }).toString();
      const r = await fetch(`${BASE}/${mediaId}?${qs}`);
      const d = await r.json();
      permalink = d?.permalink || '';
    } catch (_) {}

    // 記錄發文 log(依主題,供成效分析)
    await appendLog({
      ts: Date.now(), mediaId, permalink,
      topicId, topicName, type,
      textPreview: body.slice(0, 60),
    });

    return NextResponse.json({ ok: true, id: mediaId, permalink });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
