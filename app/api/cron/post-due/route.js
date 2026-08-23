// 到點自動發文:Vercel Cron 定時打這裡,把佇列中「到期且待發」的貼文發到 Threads。
// 也可由前端「立即檢查發送」手動觸發。
import { NextResponse } from 'next/server';
import { threadsCreds, publishThreads, appendPostLog, readQueue, writeQueue } from '@/lib/threads.js';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_PER_RUN = 8; // 單次最多發幾則(留餘裕避免逾時)

async function run() {
  if (!threadsCreds().ok) return { error: 'Threads 未設定', posted: 0 };
  const items = await readQueue();
  const now = Date.now();
  const due = items.filter((x) => x.status === 'pending' && (x.scheduledTs || 0) <= now).slice(0, MAX_PER_RUN);
  let posted = 0, failed = 0;
  for (const it of due) {
    try {
      const { mediaId, permalink } = await publishThreads(it.text, it.imageUrl || "");
      it.status = 'posted'; it.mediaId = mediaId; it.permalink = permalink; it.postedTs = Date.now();
      await appendPostLog({ ts: it.postedTs, mediaId, permalink, topicId: it.topicId, topicName: it.topicName, type: it.type, textPreview: (it.text || '').slice(0, 60) });
      posted++;
    } catch (e) {
      it.status = 'failed'; it.error = String(e.message).slice(0, 200);
      failed++;
    }
  }
  if (due.length > 0) await writeQueue(items);
  const remaining = items.filter((x) => x.status === 'pending').length;
  return { posted, failed, remaining };
}

export async function GET(req) {
  // 若有設 CRON_SECRET,Vercel Cron 會帶 Authorization: Bearer <secret>;沒設則放行
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try { return NextResponse.json(await run()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST() {
  // 手動觸發(前端「立即檢查發送」)
  try { return NextResponse.json(await run()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}
