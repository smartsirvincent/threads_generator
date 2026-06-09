// Chunked: 一次只生一個 batch (≤8 篇),client 控制迴圈
// 每個 call < 20s,遠低於 Vercel Hobby 60s 上限
import { NextResponse } from 'next/server';
import { generateOneBatch, generateOneBatchDryRun } from '@/lib/generate-posts.js';
import { normalizeInput } from '@/lib/normalize.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const { input: rawInput, theme, count, previousTitles = [], startIndex = 0 } = await req.json();
    const input = normalizeInput(rawInput);

    if (!theme?.name || !theme?.type) {
      return NextResponse.json({ error: 'theme.name + theme.type required' }, { status: 400 });
    }

    const batchCount = Math.min(Math.max(1, count || 8), 8);

    const result = input.dry_run
      ? generateOneBatchDryRun({ theme, input, count: batchCount, startIndex })
      : await generateOneBatch({ theme, input, count: batchCount, previousTitles });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
