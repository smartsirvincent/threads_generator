// 批次價格分配:使用者貼一大串價目表 → LLM 對應到每個療程 → 回各療程的 promo_offer
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `你是醫美診所的價目整理助手。使用者會貼上一大串「原始價目表文字」,以及一份「療程清單」。
你的任務:把原始文字裡的價格/優惠,對應到清單中每一個療程,整理成乾淨的一行價格字串。

規則:
- 只根據原始文字對應,**不可自行編造價格**。找不到對應的療程,該筆 promo_offer 回空字串 ""。
- 名稱用模糊比對(例:「海芙」對應「海芙音波三代 HIFU」;「電波」對應「完美電波 Oligio」)。
- promo_offer 精簡好讀,保留數字與單位,例:"6,999／400 發"、"1,999／cc,整瓶 8cc 13,999"、"每人 5,000 醫美券直接抵"。
- 一個療程若原始文字有多個價格(不同劑量/發數),用「;」或「/」串在同一行。
- 只輸出 JSON,不要多餘說明。

輸出 JSON 格式(嚴格遵守):
{
  "prices": [
    { "name": "<療程清單中的原名,一字不差>", "promo_offer": "<整理後的價格字串或空字串>" }
  ]
}
prices 陣列必須涵蓋清單中的每一個療程(順序不限),name 必須與清單完全一致。`;

export async function POST(req) {
  try {
    const { rawText, names } = await req.json();
    if (!rawText || typeof rawText !== 'string') {
      return NextResponse.json({ error: '請貼上價目表文字' }, { status: 400 });
    }
    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ error: '療程清單為空' }, { status: 400 });
    }

    const user = `**療程清單(共 ${names.length} 個,name 要一字不差對回)**:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

**原始價目表文字**:
${rawText.slice(0, 4000)}

請把價格對應到每個療程,回 JSON。`;

    const parsed = await callJSON({ system: SYSTEM, user, maxTokens: 2000, temperature: 0.2 });
    const list = Array.isArray(parsed.prices) ? parsed.prices : [];

    // 只保留清單內的名稱,並確保每個療程都有一筆(找不到給空字串)
    const byName = new Map(list.map((p) => [String(p.name || '').trim(), String(p.promo_offer || '').trim()]));
    const prices = names.map((n) => ({ name: n, promo_offer: byName.get(n) || '' }));

    return NextResponse.json({ prices });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
