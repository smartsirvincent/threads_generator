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
    if (body.weatherDaily && typeof body.weatherDaily === 'object') {
      next.weatherDaily = {
        enabled: !!body.weatherDaily.enabled,
        time: /^\d{2}:\d{2}$/.test(body.weatherDaily.time || '') ? body.weatherDaily.time : '08:00',
      };
    }
    // 建立主題可插入的「特色」清單(可自行新增/刪除)
    if (Array.isArray(body.insertVars)) {
      next.insertVars = body.insertVars
        .map((v) => String(v || '').trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 30);
    }
    await writeSettings(next);
    return NextResponse.json({ ok: true, ...next });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
