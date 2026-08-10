// 價格異動紀錄:/brand 存檔時比對出的 {name, from, to} 存這裡,供「更新未發價格」套用
import { NextResponse } from 'next/server';
import { readPriceChanges, writePriceChanges } from '@/lib/threads.js';
import { hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try { return NextResponse.json({ changes: await readPriceChanges() }); }
  catch (e) { return NextResponse.json({ changes: [], error: e.message }); }
}

export async function POST(req) {
  try {
    if (!hasCloudinary()) return NextResponse.json({ error: 'Cloudinary 未設定' }, { status: 503 });
    const { action = 'add', changes: incoming } = await req.json();
    let changes = await readPriceChanges();
    if (action === 'clear') { await writePriceChanges([]); return NextResponse.json({ ok: true, total: 0 }); }
    if (action === 'add') {
      const add = (incoming || [])
        .filter((c) => c && c.from && c.to && c.from !== c.to)
        .map((c) => ({ name: String(c.name || '').slice(0, 80), from: String(c.from).slice(0, 200), to: String(c.to).slice(0, 200), ts: Date.now() }));
      // 去重(同 from→to 只留一筆,更新 ts)
      const map = new Map(changes.map((c) => [`${c.from}=>${c.to}`, c]));
      for (const c of add) map.set(`${c.from}=>${c.to}`, c);
      changes = Array.from(map.values());
      await writePriceChanges(changes);
      return NextResponse.json({ ok: true, added: add.length, total: changes.length });
    }
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
