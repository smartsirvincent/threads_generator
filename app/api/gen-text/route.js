// Chunked: 一次只生成一個主題的所有文案
// Vercel Hobby 友善: 單一 call < 60s
import { NextResponse } from 'next/server';
import { generateThemePosts, generateThemePostsDryRun } from '@/lib/generate-posts.js';
import { normalizeInput } from '@/lib/normalize.js';

export const runtime = 'nodejs';
export const maxDuration = 60; // Hobby 上限 60s 就夠了,單主題只跑 4 批內

export async function POST(req) {
  try {
    const { input: rawInput, theme } = await req.json();
    const input = normalizeInput(rawInput);

    if (!theme?.name || !theme?.type) {
      return NextResponse.json({ error: 'theme.name + theme.type required' }, { status: 400 });
    }

    const posts = input.dry_run
      ? generateThemePostsDryRun({ theme, input })
      : await generateThemePosts({ theme, input });

    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
