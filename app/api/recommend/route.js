import { NextResponse } from 'next/server';
import { recommendThemes, recommendThemesDryRun } from '@/lib/recommend.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const input = await req.json();
    const themes = input.dry_run
      ? recommendThemesDryRun(input)
      : await recommendThemes(input);
    return NextResponse.json({ themes });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
