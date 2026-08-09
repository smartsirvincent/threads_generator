// 主題發想:依分類 + 診所/療程情境,AI 給 6 個 Threads 主題點子
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { clinicContextText } from '@/lib/verticals.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const CAT_HINT = {
  treatment: '針對指定療程,發想能引起共鳴的貼文角度(痛點/效果/適合誰/迷思)',
  spot: '曼谷在地景點/咖啡廳/商圈/美食介紹,並自然扣「來曼谷旅遊順便變美」的角度',
  promo: '促銷組合/醫美券/旅遊套餐的導購角度,帶價格誘因但不誇大',
  education: '醫美衛教與迷思破解(術後保養、療程比較、選擇要點)',
  opinion: '閨蜜口吻的觀點/情境小故事(變美心情、姐妹對話、旅遊變美的體悟)',
};

const SYSTEM = `你是醫美診所「泰國醫美 Best Friend」的社群主編,口吻像親暱、真誠的閨蜜。請針對指定分類發想 6 個 Threads 貼文主題(短句,像貼文標題)。
規則:繁體中文;閨蜜口吻、不浮誇;醫療廣告合規(不用保證見效/永久/最便宜);主題要具體、有畫面、能引發互動。
輸出 JSON(嚴格):{"topics":["主題1","主題2","主題3","主題4","主題5","主題6"]}`;

export async function POST(req) {
  try {
    const { category = 'treatment', treatmentName = '', keyword = '', brand, brand_persona, audience, clinic } = await req.json();
    const clinicText = clinicContextText(clinic);
    const user = `**分類**: ${category} — ${CAT_HINT[category] || CAT_HINT.treatment}
${treatmentName ? `**指定療程**: ${treatmentName}` : ''}
${keyword ? `**指定關鍵字/景點**: ${keyword}` : ''}
**診所**: ${brand || '泰國醫美 Best Friend'}
**口吻**: ${brand_persona || '閨蜜、真誠、務實'}
**受眾**: ${audience || '20-45 歲、想到曼谷旅遊順便變美的台灣女性'}
${clinicText ? `**診所資訊**:\n${clinicText}` : ''}

請發想 6 個主題,直接回 JSON。`;
    const parsed = await callJSON({ system: SYSTEM, user, maxTokens: 1200, temperature: 0.95 });
    const topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 6) : [];
    return NextResponse.json({ topics });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
