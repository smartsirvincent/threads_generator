// 排程佇列:待發貼文清單(存 Cloudinary 固定槽)。GET 列出;POST 依 action 增/刪。
import { NextResponse } from 'next/server';
import { readQueue, writeQueue } from '@/lib/threads.js';
import { hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const newId = () => `q-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

export async function GET() {
  try {
    const items = await readQueue();
    items.sort((a, b) => (a.scheduledTs || 0) - (b.scheduledTs || 0));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: e.message });
  }
}

export async function POST(req) {
  try {
    if (!hasCloudinary()) return NextResponse.json({ error: 'Cloudinary 未設定' }, { status: 503 });
    const body = await req.json();
    const action = body.action || 'add';
    let items = await readQueue();

    if (action === 'add') {
      const add = (body.items || [])
        .filter((x) => (x.text || '').trim())
        .map((x) => ({
          id: newId(),
          text: String(x.text).slice(0, 500),
          topicId: x.topicId || '', topicName: x.topicName || '', type: x.type || '',
          scheduledTs: Number(x.scheduledTs) || Date.now(),
          status: 'pending', mediaId: '', permalink: '', error: '',
        }));
      items = [...items, ...add];
      await writeQueue(items);
      return NextResponse.json({ ok: true, added: add.length, total: items.length });
    }
    if (action === 'remove') {
      items = items.filter((x) => x.id !== body.id);
      await writeQueue(items);
      return NextResponse.json({ ok: true, total: items.length });
    }
    if (action === 'clearPosted') {
      items = items.filter((x) => x.status !== 'posted');
      await writeQueue(items);
      return NextResponse.json({ ok: true, total: items.length });
    }
    if (action === 'update') {
      items = items.map((x) => x.id === body.id ? { ...x, ...body.patch } : x);
      await writeQueue(items);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
