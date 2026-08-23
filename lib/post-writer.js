// 依主題產一篇貼文的共用邏輯(給 /api/post/write 與每日自動產文 cron 用)
import { callJSON } from '@/lib/llm.js';
import { clinicContextText } from '@/lib/verticals.js';

export const TYPE_SPEC = {
  text: '純文字短貼文:120-300 字,口語、開頭要有 hook、易互動,少量 emoji,結尾軟性 CTA + 2-4 hashtag。',
  long: '長文:400-500 字(務必 <500),故事/衛教/深度觀點,分段清楚、有層次,結尾 CTA + 2-4 hashtag。',
  image: '圖片貼文的圖說文字:精簡 60-160 字,搭配一張圖用,重點清楚、口語,1-3 hashtag。',
};

// ── 差異化變數矩陣:同主題不同篇,靠這些軸的「不同組合 + 不同視角」拉開區別度 ──
const POV = [ // 敘事視角/人稱
  '第一人稱親身經歷:妳自己做過這個療程,分享真實過程與感受',
  '閨蜜私下勸敗:像在跟好姊妹咬耳朵推薦,語氣親暱',
  '過來人踩雷提醒:先講自己當初的錯誤/迷思,再給建議',
  '客人最常問的問題:從「最多人問我…」切入做 Q&A',
  '診所現場觀察:從諮詢/療程當天看到的真實情境寫起',
  '旅途中的變美日記:把療程放進一趟曼谷小旅行的其中一天',
];
const HOOK = [ // 開場 hook 類型
  '用一個直戳痛點的提問開場',
  '用反差開場(原本以為…結果…)',
  '用具體數字或清單開場(例:3 個…)',
  '用情境代入開場(某個時間/場景的畫面)',
  '用破解迷思開場(大家都說…其實不是)',
  '用一句大膽金句/心聲開場',
];
const FOCUS = [ // 內容焦點
  '聚焦「真實感受與效果」',
  '聚焦「划算與預算」,自然帶到每人 5,000 醫美券直接抵',
  '聚焦「恢復期與術後真實狀況」',
  '聚焦「這適合誰、不適合誰」',
  '聚焦「來曼谷旅遊順便變美」的行程感',
  '聚焦「安全與正確觀念」的衛教角度',
  '聚焦「療程前後的心境轉變」',
];
const TONE = [ // 語氣風味
  '溫柔療癒、被同理的感覺',
  '幽默俏皮、帶點自嘲哏',
  '直白坦率、不繞圈子',
  '知性穩重、像懂很多的姊姊',
  '興奮分享、藏不住的好心情',
];
const STRUCT = [ // 篇章結構
  '用一個小故事的起承轉合鋪陳',
  '用條列重點(但仍保有口語溫度)',
  '用一問一答的對話感',
  '用「情境 → 轉折 → 建議」推進',
  '用「心得 → 為什麼 → 溫柔邀約」收束',
];
const ANCHOR = [ // 具體情境錨點(逼出畫面,不空泛)
  '綁定一個時間點:週五下班後',
  '綁定一個場景:曼谷飯店的浴室鏡子前',
  '綁定一種心情:拍照又想修圖的那種在意',
  '綁定一個對象:準備參加婚禮/同學會前',
  '綁定一個季節:曼谷很曬的大熱天',
  '綁定一個瞬間:素顏被朋友說氣色變好',
  '綁定一個煩惱:法令紋/膚況讓妳顯老',
];

const pick = (arr, i, stride, off = 0) => arr[((i * stride + off) % arr.length + arr.length) % arr.length];

// 用不同步長取各軸,讓 variant 遞增時多個軸「同時變動」,組合快速拉開差異
function variationSpec(variant) {
  const i = Math.max(0, variant | 0);
  return {
    pov: pick(POV, i, 1),
    hook: pick(HOOK, i, 3, 1),
    focus: pick(FOCUS, i, 2, 0),
    tone: pick(TONE, i, 4, 2),
    struct: pick(STRUCT, i, 3, 1),
    anchor: pick(ANCHOR, i, 5, 3),
  };
}

const SYSTEM = `你是醫美診所「泰國醫美 Best Friend」的社群文案,口吻像親暱真誠的閨蜜(用「妳」稱呼)。
請依「主題 + 提示詞 + 型別規格 + 差異化設定」寫一篇可直接發佈的貼文。
規則:繁體中文、口語、有溫度、不浮誇、不硬推銷;**醫療合規**(不用保證見效/永久/最便宜/第一);Threads 上限 500 字務必遵守;可自然帶療程效果/價格/「每人 5,000 醫美券直接抵」/旅遊套餐;景點主題則介紹景點並扣「來曼谷變美順便玩」。
**主題必須扣緊**:整篇只能圍繞下方指定的【主題】與提示詞,不可換成其他療程或跑題(例如主題是「海芙音波」就不要寫成皮秒/雷射)。
**差異化**:同一主題會產很多篇,務必讓每一篇的「視角、開場、焦點、語氣、結構」都明顯不同,不要有雷同的句型或開場;嚴格遵守下方指定的差異化設定來寫這一篇——變化的是「怎麼講」,不是「講什麼」。
輸出 JSON(嚴格):{"text":"完整貼文(含換行與 hashtag)"}`;

export async function writePost({ type = 'text', topicName = '', prompt = '', brand, brand_persona, audience, clinic, variant = 0 }) {
  const t = ['text', 'long', 'image'].includes(type) ? type : 'text';
  const clinicText = clinicContextText(clinic);
  const v = variationSpec(variant);
  const variantBlock = `**這一篇的差異化設定(務必遵守,且與其他篇明顯不同)**:
- 敘事視角:${v.pov}
- 開場方式:${v.hook}
- 內容焦點:${v.focus}
- 語氣風味:${v.tone}
- 篇章結構:${v.struct}
- 具體情境:${v.anchor}`;
  const user = `**型別規格**: ${TYPE_SPEC[t]}
${variantBlock}
**主題**: ${topicName}
**提示詞(依此發揮)**: ${prompt || topicName}
**診所**: ${brand || '泰國醫美 Best Friend'}
**口吻**: ${brand_persona || '閨蜜、真誠、務實'}
**受眾**: ${audience || '20-45 歲、想到曼谷旅遊順便變美的台灣女性'}
${clinicText ? `**診所資訊**:\n${clinicText}` : ''}

請依上面的差異化設定寫這一篇貼文,直接回 JSON。`;
  const parsed = await callJSON({ system: SYSTEM, user, maxTokens: 1500, temperature: 1.0 });
  let text = (parsed.text || '').trim();
  if (text.length > 500) text = text.slice(0, 498) + '…';
  return text;
}
