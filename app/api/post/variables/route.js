// 為「已存在的主題」產生 2-3 個區分變數維度(varOptions),給舊主題補上變數用
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `你是社群內容策略師。針對一個貼文主題,設計 2-3 個「區分變數」維度,讓同主題每篇可以聚焦不同的具體對象。
每個維度含 label(維度名,例:捷運站/療程項目/客人類型/夜市小吃)+ 8-15 個具體值 values(每個都是一篇可寫的具體對象,彼此不同、都跟主題相關)。
繁體中文。輸出 JSON(嚴格):{"varOptions":[{"label":"維度名","values":["值1","…(8-15個)"]},{"label":"另一種切法","values":[…]},{"label":"第三種(選填)","values":[…]}]}`;

export async function POST(req) {
  try {
    const { name = '', prompt = '', culture = false } = await req.json();
    if (!name && !prompt) return NextResponse.json({ error: '缺少主題' }, { status: 400 });
    const user = `**主題**: ${name}
**提示詞/方向**: ${prompt || name}
${culture ? '(這是純泰國文化/旅遊主題,變數請圍繞文化/旅遊,不要出現產品/療程/品牌)' : ''}
請為此主題設計 2-3 個區分變數維度,直接回 JSON。`;
    const parsed = await callJSON({ system: SYSTEM, user, maxTokens: 3000, temperature: 0.85 });
    const varOptions = (Array.isArray(parsed.varOptions) ? parsed.varOptions : [])
      .filter((o) => o && o.label).slice(0, 3)
      .map((o) => ({ label: String(o.label).slice(0, 20), values: Array.isArray(o.values) ? o.values.filter(Boolean).map((v) => String(v).slice(0, 40)).slice(0, 20) : [] }));
    return NextResponse.json({ varOptions });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
