// 一鍵發到 Threads(官方 Graph API,兩步:建立容器 → 發佈)
// 需要環境變數:THREADS_USER_ID、THREADS_ACCESS_TOKEN(長期權杖)
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE = 'https://graph.threads.net/v1.0';

function creds() {
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  return { userId, token, ok: !!(userId && token) };
}

async function threadsPost(path, params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/${path}?${qs}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function GET() {
  // 讓前端知道有沒有設好 token(不外洩內容)
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
    const { text } = await req.json();
    const body = (text || '').trim();
    if (!body) return NextResponse.json({ error: '貼文內容不可空白' }, { status: 400 });
    if (body.length > 500) return NextResponse.json({ error: 'Threads 貼文上限 500 字' }, { status: 400 });

    // (1) 建立文字容器
    const created = await threadsPost(`${userId}/threads`, {
      media_type: 'TEXT',
      text: body,
      access_token: token,
    });
    const creationId = created.id;
    if (!creationId) throw new Error('建立容器失敗:沒有回傳 id');

    // (2) 發佈
    const published = await threadsPost(`${userId}/threads_publish`, {
      creation_id: creationId,
      access_token: token,
    });
    const mediaId = published.id;

    // (3) 取永久連結(失敗不致命)
    let permalink = '';
    try {
      const qs = new URLSearchParams({ fields: 'permalink', access_token: token }).toString();
      const r = await fetch(`${BASE}/${mediaId}?${qs}`);
      const d = await r.json();
      permalink = d?.permalink || '';
    } catch (_) {}

    return NextResponse.json({ ok: true, id: mediaId, permalink });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
