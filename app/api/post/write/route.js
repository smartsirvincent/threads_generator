// AI 產文:依主題寫一篇可直接發的 Threads 貼文(閨蜜口吻、繁中、醫療合規)
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { clinicContextText } from '@/lib/verticals.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `你是醫美診所「泰國醫美 Best Friend」的社群文案,口吻像親暱真誠的閨蜜(用「妳」稱呼)。請把主題寫成一篇可直接發佈的 Threads 貼文。
規則:
- 繁體中文、口語、有溫度、不浮誇、不硬推銷;開頭第一句要有 hook。
- 長度約 120–400 字(Threads 上限 500 字,務必 <500)。可分段、少量 emoji(0–3 個)。
- **醫療廣告合規**:不用「保證見效/永久/最便宜/第一/絕對」等字眼,講「自然、改善、漸進」。
- 若是療程/促銷主題,可自然帶到療程效果、價格或「每人 5,000 醫美券直接抵」、旅遊套餐;景點主題則介紹景點並自然扣「來曼谷變美順便玩」。
- 結尾可帶軟性 CTA(私訊/LINE 詢問),並加 2–4 個相關 hashtag。
輸出 JSON(嚴格):{"text":"完整貼文內容(含換行與 hashtag)"}`;

export async function POST(req) {
  try {
    const { category = 'treatment', topic = '', treatmentName = '', treatmentFeatures = '', treatmentPrice = '', keyword = '', brand, brand_persona, audience, clinic } = await req.json();
    if (!topic && !treatmentName && !keyword) {
      return NextResponse.json({ error: '請先選一個主題' }, { status: 400 });
    }
    const clinicText = clinicContextText(clinic);
    const user = `**分類**: ${category}
**主題**: ${topic || treatmentName || keyword}
${treatmentName ? `**療程**: ${treatmentName}` : ''}
${treatmentFeatures ? `**療程特點**: ${treatmentFeatures.slice(0, 220)}` : ''}
${treatmentPrice ? `**價格/優惠**: ${treatmentPrice}` : ''}
${keyword ? `**景點/關鍵字**: ${keyword}` : ''}
**診所**: ${brand || '泰國醫美 Best Friend'}
**口吻**: ${brand_persona || '閨蜜、真誠、務實'}
**受眾**: ${audience || '20-45 歲、想到曼谷旅遊順便變美的台灣女性'}
${clinicText ? `**診所資訊**:\n${clinicText}` : ''}

請寫一篇 Threads 貼文,直接回 JSON。`;
    const parsed = await callJSON({ system: SYSTEM, user, maxTokens: 1500, temperature: 0.9 });
    let text = (parsed.text || '').trim();
    if (text.length > 500) text = text.slice(0, 498) + '…';
    if (!text) return NextResponse.json({ error: 'AI 沒產出內容,請重試' }, { status: 500 });
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
