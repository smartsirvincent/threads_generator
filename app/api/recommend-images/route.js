import { NextResponse } from 'next/server';
import { recommendImageThemes, recommendImageThemesDryRun } from '@/lib/recommend-images.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const input = await req.json();
    const themes = input.dry_run
      ? recommendImageThemesDryRun(input)
      : await recommendImageThemes(input);
    return NextResponse.json({ themes });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
