// AI 產文:依「已確認主題」的型別 + 提示詞,產出可直接發的貼文
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { clinicContextText } from '@/lib/verticals.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TYPE_SPEC = {
  text: '純文字短貼文:120-300 字,口語、開頭要有 hook、易互動,少量 emoji,結尾軟性 CTA + 2-4 hashtag。',
  long: '長文:400-500 字(務必 <500),故事/衛教/深度觀點,分段清楚、有層次,結尾 CTA + 2-4 hashtag。',
  image: '圖片貼文的圖說文字:精簡 60-160 字,搭配一張圖用,重點清楚、口語,1-3 hashtag。',
};

const SYSTEM = `你是醫美診所「泰國醫美 Best Friend」的社群文案,口吻像親暱真誠的閨蜜(用「妳」稱呼)。
請依「主題 + 提示詞 + 型別規格」寫一篇可直接發佈的貼文。
規則:繁體中文、口語、有溫度、不浮誇、不硬推銷;**醫療合規**(不用保證見效/永久/最便宜/第一);Threads 上限 500 字務必遵守;可自然帶療程效果/價格/「每人 5,000 醫美券直接抵」/旅遊套餐;景點主題則介紹景點並扣「來曼谷變美順便玩」。
輸出 JSON(嚴格):{"text":"完整貼文(含換行與 hashtag)"}`;

export async function POST(req) {
  try {
    const { type = 'text', topicName = '', prompt = '', brand, brand_persona, audience, clinic, variant = 0 } = await req.json();
    if (!topicName && !prompt) {
      return NextResponse.json({ error: '缺少主題或提示詞' }, { status: 400 });
    }
    const t = ['text', 'long', 'image'].includes(type) ? type : 'text';
    const clinicText = clinicContextText(clinic);
    const variantHint = variant > 0 ? `\n**系列第 ${variant + 1} 則**: 請用與其他篇「明顯不同」的開場 hook 與切入角度,不要重複句型或例子。` : '';
    const user = `**型別規格**: ${TYPE_SPEC[t]}${variantHint}
**主題**: ${topicName}
**提示詞(依此發揮)**: ${prompt || topicName}
**診所**: ${brand || '泰國醫美 Best Friend'}
**口吻**: ${brand_persona || '閨蜜、真誠、務實'}
**受眾**: ${audience || '20-45 歲、想到曼谷旅遊順便變美的台灣女性'}
${clinicText ? `**診所資訊**:\n${clinicText}` : ''}

請寫一篇貼文,直接回 JSON。`;
    const parsed = await callJSON({ system: SYSTEM, user, maxTokens: 1500, temperature: 0.9 });
    let text = (parsed.text || '').trim();
    if (text.length > 500) text = text.slice(0, 498) + '…';
    if (!text) return NextResponse.json({ error: 'AI 沒產出內容,請重試' }, { status: 500 });
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
