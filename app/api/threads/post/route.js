// 一鍵發到 Threads(立即)+ 依主題寫入發文 log
import { NextResponse } from 'next/server';
import { getThreadsCreds, publishThreadsText, appendPostLog } from '@/lib/threads.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const c = await getThreadsCreds();
  return NextResponse.json({ configured: c.ok });
}

export async function POST(req) {
  try {
    if (!(await getThreadsCreds()).ok) {
      return NextResponse.json({ error: 'Threads 尚未設定。請到「內容發文 → 排程」的「Threads 連線」設定。', configured: false }, { status: 503 });
    }
    const { text, topicId = '', topicName = '', type = '' } = await req.json();
    const { mediaId, permalink } = await publishThreadsText(text);
    await appendPostLog({ ts: Date.now(), mediaId, permalink, topicId, topicName, type, textPreview: (text || '').slice(0, 60) });
    return NextResponse.json({ ok: true, id: mediaId, permalink });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
