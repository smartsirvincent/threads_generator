// 一鍵發到 Threads(立即)+ 依主題寫入發文 log
import { NextResponse } from 'next/server';
import { threadsCreds, publishThreadsText, appendPostLog } from '@/lib/threads.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ configured: threadsCreds().ok });
}

export async function POST(req) {
  try {
    if (!threadsCreds().ok) {
      return NextResponse.json({ error: 'Threads 尚未設定。請在 Vercel 加入 THREADS_USER_ID 與 THREADS_ACCESS_TOKEN。', configured: false }, { status: 503 });
    }
    const { text, topicId = '', topicName = '', type = '' } = await req.json();
    const { mediaId, permalink } = await publishThreadsText(text);
    await appendPostLog({ ts: Date.now(), mediaId, permalink, topicId, topicName, type, textPreview: (text || '').slice(0, 60) });
    return NextResponse.json({ ok: true, id: mediaId, permalink });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
