// 設定:每日自動產文開關
import { NextResponse } from 'next/server';
import { readSettings, writeSettings } from '@/lib/threads.js';
import { hasCloudinary } from '@/lib/cloudinary.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET() {
  try { return NextResponse.json(await readSettings()); }
  catch (e) { return NextResponse.json({ dailyAuto: false, error: e.message }); }
}

export async function POST(req) {
  try {
    if (!hasCloudinary()) return NextResponse.json({ error: 'Cloudinary 未設定' }, { status: 503 });
    const body = await req.json();
    const cur = await readSettings();
    const next = { ...cur };
    if (typeof body.dailyAuto === 'boolean') next.dailyAuto = body.dailyAuto;
    await writeSettings(next);
    return NextResponse.json({ ok: true, ...next });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
