// 主題發想:AI 依「純文字 / 長文 / 圖片」三大類各推幾個主題,每個附可編輯的提示詞
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';
import { clinicContextText } from '@/lib/verticals.js';

export const runtime = 'nodejs';
export const maxDuration = 120;

const TYPE_HINT = {
  text: '純文字短貼文(Threads,120-300字,口語、有 hook、易互動)',
  long: '長文(400-500字,故事/衛教/深度觀點,層次分明)',
  image: '圖片貼文(以一張圖為主,文字精簡當圖說;主題要有清楚視覺畫面)',
};

const SYSTEM = `你是醫美診所「泰國醫美 Best Friend」的社群內容策略師,口吻像親暱真誠的閨蜜。
請針對指定的貼文型別發想主題,每個主題附一段「提示詞」——這個提示詞是給之後 AI 產文用的「方向與素材庫」。

**提示詞怎麼寫(關鍵)**:同一個主題之後會產出「很多篇」不同的貼文,所以提示詞必須留變化空間,寫成有彈性的 brief,**不要寫成逐字腳本**。提示詞請用這個固定格式:
「核心訊息:(一句話講這主題想傳達什麼)。可選切角(每篇挑一個深入,不要全用):①… ②… ③… ④… ⑤…(至少 5 個具體、彼此不同的角度/素材/故事點)。可帶素材:(診所賣點/價格/醫美券/景點等,擇需使用)。語氣:…。」
硬性規定:**不准寫固定開場白、不准指定範例開場句、不准規定固定條列點數(如「三件事」)、不准指定任何固定結尾句或結尾問句**——這些都會害每篇長一樣。提示詞只給「方向與可選素材」,把「怎麼開場、講哪幾點、怎麼收尾」全部留給產文時決定。

**每個主題要提供 2-3 個「區分變數」候選維度(varOptions)**:每個維度是讓同主題每篇聚焦「不同具體對象」的一種切法,含 label(維度名,例:療程項目/客人類型/常見疑慮)+ 8-15 個具體值 values。給 2-3 種不同的切法讓使用者挑。值要具體、彼此不同、都跟主題相關。

規則:繁體中文;閨蜜口吻、不浮誇;醫療廣告合規(不用保證見效/永久/最便宜);主題要「夠大」能容納很多篇、有畫面、能互動;可涵蓋療程、曼谷景點(來變美順便玩)、促銷、衛教、閨蜜情境。
**主題名稱務必精簡在 10 個字以內**(只是分類標籤,細節寫在提示詞裡)。
輸出 JSON(嚴格):{"topics":[{"name":"主題(≤10字)","prompt":"彈性 brief 100-180字","varOptions":[{"label":"維度名","values":["值1","…(8-15個)"]},{"label":"另一種切法","values":[…]},{"label":"第三種(選填)","values":[…]}]}]}`;

// 純泰國文化/旅遊:完全不談產品、品牌、療程、促銷
const CULTURE_SYSTEM = `你是經營一個「泰國文化/旅遊」風格 Threads 帳號的內容策略師,口吻像親暱真誠的閨蜜。
請發想「純泰國文化 / 旅遊」主題。**主題範圍只能是**:美食小吃、寺廟古蹟、交通(BTS/計程車/嘟嘟車)、節慶(潑水節/水燈節)、語言泰文、禮俗禁忌、購物市集、按摩SPA文化、咖啡廳、自然景點海島、歷史、生活觀察、旅遊撇步等。
**絕對禁止**:任何跟美容、保養、變美、醫美、皮膚、素顏、抗老、療程、診所、產品、品牌、促銷、優惠有關的主題或字眼——連「順便變美」「醫美行程」這類都不行。主題要能讓「對泰國有興趣但不見得想變美」的人也想看。
提示詞寫法(關鍵):同一主題會產很多篇,提示詞要寫成有彈性的 brief,用固定格式:
「核心訊息:(一句話)。可選切角(每篇挑一個深入,不要全用):①… ②… ③… ④… ⑤…(至少5個具體、彼此不同的角度/故事點)。語氣:…。」
**每個主題要提供 2-3 個「區分變數」候選維度(varOptions)**:每個含 label(維度名,例:捷運站/泰國人類型/夜市小吃/寺廟)+ 8-15 個具體值 values(如 Siam站/Asok站…、司機/按摩師/夜市老闆…)。給 2-3 種不同切法讓使用者挑。值要具體、彼此不同、都跟主題相關。
硬性規定:不准寫固定開場白、不准指定範例開場句、不准規定固定條列點數、不准指定固定結尾句;不得出現任何產品/品牌/療程/優惠字眼。主題名稱≤10字。
輸出 JSON(嚴格):{"topics":[{"name":"主題(≤10字)","prompt":"彈性 brief 100-180字","varOptions":[{"label":"維度名","values":["值1","…(8-15個)"]},{"label":"另一種切法","values":[…]},{"label":"第三種(選填)","values":[…]}]}]}`;

export async function POST(req) {
  try {
    const { type = 'text', count = 4, keyword = '', brand, brand_persona, audience, clinic, culture = false } = await req.json();
    const t = ['text', 'long', 'image'].includes(type) ? type : 'text';
    const clinicText = clinicContextText(clinic);
    const n = Math.min(Math.max(Number(count) || 4, 1), 8);
    const user = culture
      ? `**貼文型別**: ${t} — ${TYPE_HINT[t]}
${keyword ? `**參考主題/方向**: ${keyword}` : ''}
**受眾**: ${audience || '20-45 歲、喜歡泰國旅遊的台灣女性'}

請發想 ${n} 個「${t}」型別的「純泰國文化/旅遊」主題(完全不談產品/品牌/療程/促銷),每個附彈性 brief。直接回 JSON。`
      : `**貼文型別**: ${t} — ${TYPE_HINT[t]}
${keyword ? `**參考關鍵字/方向**: ${keyword}` : ''}
**診所**: ${brand || '泰國醫美 Best Friend'}
**口吻**: ${brand_persona || '閨蜜、真誠、務實'}
**受眾**: ${audience || '20-45 歲、想到曼谷旅遊順便變美的台灣女性'}
${clinicText ? `**診所資訊**:\n${clinicText}` : ''}

請發想 ${n} 個「${t}」型別的主題,每個附提示詞。直接回 JSON。`;
    const parsed = await callJSON({ system: culture ? CULTURE_SYSTEM : SYSTEM, user, maxTokens: 8000, temperature: culture ? 0.85 : 0.95 });
    const topics = (Array.isArray(parsed.topics) ? parsed.topics : [])
      .filter((x) => x && x.name)
      .map((x) => {
        const varOptions = Array.isArray(x.varOptions) ? x.varOptions.filter((o) => o && o.label).slice(0, 3).map((o) => ({
          label: String(o.label).slice(0, 20),
          values: Array.isArray(o.values) ? o.values.filter(Boolean).map((v) => String(v).slice(0, 40)).slice(0, 20) : [],
        })) : [];
        // 相容舊格式:若只給 varLabel/variables 也收
        if (!varOptions.length && (x.varLabel || x.variables)) varOptions.push({ label: String(x.varLabel || '').slice(0, 20), values: Array.isArray(x.variables) ? x.variables.map((v) => String(v).slice(0, 40)).slice(0, 20) : [] });
        const first = varOptions[0] || { label: '', values: [] };
        return {
          type: t, name: String(x.name).replace(/\s+/g, '').slice(0, 10),
          prompt: String(x.prompt || '').slice(0, 500), culture: !!culture,
          varOptions,
          varLabel: first.label, variables: first.values, // 預設用第一個維度
        };
      });
    return NextResponse.json({ topics });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
