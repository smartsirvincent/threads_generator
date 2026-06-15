// Step 1/3: submit prompt to KIE V2, return taskId (~2-3s, well under 60s)
import { NextResponse } from 'next/server';
import { submitImageV2 } from '@/lib/kie-image.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req) {
  try {
    const { prompt, referenceImages = [], aspect_ratio = '1:1' } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }
    const taskId = await submitImageV2({ prompt, referenceImages, aspect_ratio });
    return NextResponse.json({ taskId });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
