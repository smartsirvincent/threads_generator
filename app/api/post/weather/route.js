// 預約發文:抓曼谷當天天氣(Open-Meteo,免金鑰),依天氣產出「注意事項 + 保養事宜」貼文
import { NextResponse } from 'next/server';
import { makeWeatherPost } from '@/lib/weather.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { brand, brand_persona, audience, clinic } = body;
    const r = await makeWeatherPost({ brand, brand_persona, audience, clinic });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
