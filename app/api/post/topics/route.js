// 主題發想:AI 依「純文字 / 長文 / 圖片」三大類各推幾個主題,每個附可編輯的提示詞
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { clinicContextText } from '@/lib/verticals.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TYPE_HINT = {
  text: '純文字短貼文(Threads,120-300字,口語、有 hook、易互動)',
  long: '長文(400-500字,故事/衛教/深度觀點,層次分明)',
  image: '圖片貼文(以一張圖為主,文字精簡當圖說;主題要有清楚視覺畫面)',
};

const SYSTEM = `你是醫美診所「泰國醫美 Best Friend」的社群內容策略師,口吻像親暱真誠的閨蜜。
請針對指定的貼文型別發想主題,每個主題都要附一段「提示詞」(給之後 AI 產文用的具體指示:角度、要點、語氣、要帶到的重點)。

規則:繁體中文;閨蜜口吻、不浮誇;醫療廣告合規(不用保證見效/永久/最便宜);主題具體、有畫面、能互動;可涵蓋療程、曼谷景點(來變美順便玩)、促銷、衛教、閨蜜情境。
**主題名稱務必精簡在 10 個字以內**(只是分類標籤,細節寫在提示詞裡)。
輸出 JSON(嚴格):{"topics":[{"name":"主題(≤10字)","prompt":"給產文 AI 的提示詞,50-120字"}]}`;

export async function POST(req) {
  try {
    const { type = 'text', count = 4, keyword = '', brand, brand_persona, audience, clinic } = await req.json();
    const t = ['text', 'long', 'image'].includes(type) ? type : 'text';
    const clinicText = clinicContextText(clinic);
    const user = `**貼文型別**: ${t} — ${TYPE_HINT[t]}
${keyword ? `**參考關鍵字/方向**: ${keyword}` : ''}
**診所**: ${brand || '泰國醫美 Best Friend'}
**口吻**: ${brand_persona || '閨蜜、真誠、務實'}
**受眾**: ${audience || '20-45 歲、想到曼谷旅遊順便變美的台灣女性'}
${clinicText ? `**診所資訊**:\n${clinicText}` : ''}

請發想 ${Math.min(Math.max(Number(count) || 4, 1), 8)} 個「${t}」型別的主題,每個附提示詞。直接回 JSON。`;
    const parsed = await callJSON({ system: SYSTEM, user, maxTokens: 2000, temperature: 0.95 });
    const topics = (Array.isArray(parsed.topics) ? parsed.topics : [])
      .filter((x) => x && x.name)
      .map((x) => ({ type: t, name: String(x.name).replace(/\s+/g, '').slice(0, 10), prompt: String(x.prompt || '').slice(0, 500) }));
    return NextResponse.json({ topics });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
