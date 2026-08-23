// 每週排程範本:GET 讀 slots;POST 存 slots。slot = {id, weekday(0-6), time 'HH:MM', topicId}
import { NextResponse } from 'next/server';
import { readWeekly, writeWeekly } from '@/lib/threads.js';
import { hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try { return NextResponse.json({ slots: await readWeekly() }); }
  catch (e) { return NextResponse.json({ slots: [], error: e.message }); }
}

export async function POST(req) {
  try {
    if (!hasCloudinary()) return NextResponse.json({ error: 'Cloudinary 未設定' }, { status: 503 });
    const { slots } = await req.json();
    if (!Array.isArray(slots)) return NextResponse.json({ error: 'slots 必須是陣列' }, { status: 400 });
    const clean = slots
      .filter((s) => s && Number.isInteger(s.weekday) && s.weekday >= 0 && s.weekday <= 6 && /^\d{2}:\d{2}$/.test(s.time || '') && s.topicId)
      .map((s) => ({ id: String(s.id || `w-${Date.now()}-${Math.round(Math.random() * 1e6)}`), weekday: s.weekday, time: s.time, topicId: String(s.topicId) }));
    await writeWeekly(clean);
    return NextResponse.json({ ok: true, count: clean.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
