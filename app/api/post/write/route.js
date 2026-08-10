// AI 產文:依「已確認主題」的型別 + 提示詞,產出可直接發的貼文
import { NextResponse } from 'next/server';
import { writePost } from '@/lib/post-writer.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body.topicName && !body.prompt) {
      return NextResponse.json({ error: '缺少主題或提示詞' }, { status: 400 });
    }
    const text = await writePost(body);
    if (!text) return NextResponse.json({ error: 'AI 沒產出內容,請重試' }, { status: 500 });
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
