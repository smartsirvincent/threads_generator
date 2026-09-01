// 素材產生器 Step 2:Claude 出標題+文案建議
// 若有 compositionRefUrl,額外用 Claude vision 分析構圖 + 偵測人物
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { callJSON } from '@/lib/llm.js';
import { isMedical, clinicContextText } from '@/lib/verticals.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

let _client = null;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const SUGGEST_SYSTEM = `你是專精台灣社群素材文案的策略師,擅長為單張視覺廣告寫主標 + 副標 + 兩種長度的文案。

**輸出 JSON 格式 (嚴格遵守)**:
{
  "titles": [
    "標題 1 (≤12 字,直接、霸氣或療癒,看品牌人格而定)",
    "標題 2 (角度不同,例如問題式)",
    "標題 3 (角度不同,例如情境式)"
  ],
  "subtitle": "副標 (≤20 字,補強標題的承諾或細節)",
  "copy_short": "短版圖中文案 (20-40 字,可放進圖內當補充說明,1-2 行,要直接、有 hook)",
  "copy_long": "長版圖中文案 (60-100 字,適合文字較重的廣告版型,可含 1-2 處換行,要把賣點+承諾+CTA 都帶到)",
  "copy": "完整貼文文案 (60-120 字,適合 IG/FB 發文用,可含換行+hashtag)"
}

規則:
- 用品牌人格說話,不要 AI 味
- 標題要有差異化,3 個分別走不同角度
- 標題不要超過 12 字 (圖片可讀性)
- 副標可帶優惠/賣點/CTA
- copy_short 是要放進圖裡的短文字,要乾淨好讀
- copy_long 是要放進圖裡的長文字,適合文字很重的廣告排版
- copy 是 IG/FB 貼文用的完整文案 (圖外的文字)`;

const SUGGEST_SYSTEM_MEDICAL = `你是專精台灣醫美診所社群素材的文案策略師,擅長為單張醫美視覺廣告寫主標 + 副標 + 兩種長度的文案。這是跨國(泰國曼谷)醫美診所,主打「像朋友一樣、費用透明、中文全程陪同、旅遊順便變美」。

**輸出 JSON 格式 (嚴格遵守)**:
{
  "titles": [
    "標題 1 (≤12 字,療癒/自信/膚況承諾角度)",
    "標題 2 (角度不同,例如痛點問題式:鬆弛/暗沉/凹陷)",
    "標題 3 (角度不同,例如旅遊+變美的情境式)"
  ],
  "subtitle": "副標 (≤20 字,補強療程效果、旅遊套餐或 5,000 醫美券)",
  "copy_short": "短版圖中文案 (20-40 字,1-2 行,乾淨好讀,可帶療程重點或安心感)",
  "copy_long": "長版圖中文案 (60-100 字,適合文字重的廣告版型,把療程效果+診所信任感+CTA 帶到)",
  "copy": "完整貼文文案 (60-120 字,IG/FB 發文用,口語溫暖、不硬推銷,可含換行+hashtag)"
}

規則:
- 用「好朋友般真誠、溫暖、務實、誠實透明」的口吻,短句、口語,不浮誇、不硬推銷
- **醫療廣告合規**:不用「保證見效/永久/最便宜/第一/絕對」等誇大或絕對字眼;不承諾療效;講「自然、漸進、改善」而非「治好」
- 標題要有差異化,3 個分別走不同角度 (膚況承諾 / 痛點 / 旅遊情境)
- 標題不要超過 12 字 (圖片可讀性)
- 可自然帶到:中文地陪與翻譯、費用透明、5,000 泰銖醫美券、曼谷旅遊順便變美
- **地陪/翻譯一律中性稱呼,不要寫性別**(不出現 男/女/先生/小姐/帥哥/美女/他/她)
- **診所下午 1 點後才營業,不要寫上午/一早去做醫美**(要提時間寫下午或傍晚)
- copy_short 放進圖裡要乾淨;copy_long 適合文字重的排版;copy 是圖外貼文`;

const SUGGEST_SYSTEM_MEDICAL_PROMO = `你是專精台灣醫美診所「促銷導購」的文案策略師,為單張醫美促銷廣告寫主標 + 副標 + 兩種長度的文案。這是跨國(泰國曼谷)醫美診所,主打「像朋友一樣、費用透明、中文全程陪同、旅遊順便變美」。這一支要能「催單」。

**輸出 JSON 格式 (嚴格遵守)**:
{
  "titles": [
    "標題 1 (≤12 字,價格/優惠鉤子,例如帶數字或『5,000 券直接抵』)",
    "標題 2 (角度不同,名額/檔期急迫感,例如『首團只接兩組』)",
    "標題 3 (角度不同,行動導向,例如『私訊卡位』)"
  ],
  "subtitle": "副標 (≤20 字,把最強的價格/優惠/贈品講清楚)",
  "copy_short": "短版圖中文案 (20-40 字,1-2 行,價格或優惠+一句 CTA)",
  "copy_long": "長版圖中文案 (60-100 字,價格/優惠/名額/醫美券/CTA 全帶到,適合文字重的促銷版型)",
  "copy": "完整貼文文案 (60-120 字,IG/FB 導購用,口語溫暖但有行動呼籲,可含換行+hashtag)"
}

規則:
- 有促銷力道、有急迫感,但**口吻仍溫暖真誠、不油、不硬凹**(這個品牌反感話術)
- **醫療廣告合規**:不用「保證見效/永久/最便宜/第一/絕對」等誇大或絕對字眼;不承諾療效
- 善用真實賣點催單:每人 5,000 泰銖醫美券「直接抵、不限療程、不需湊額度」、二日套餐價(2-3 人 8,399/人起、4-9 人 6,299/人起)、名額限制、中文全程陪同
- 標題要有差異化,3 個分別走不同角度 (價格 / 名額急迫 / 行動)
- 標題不要超過 12 字;CTA 明確 (私訊 / LINE / 卡位)
- **地陪/翻譯一律中性稱呼,不寫性別**(不出現 男/女/帥哥/美女/他/她);**診所下午 1 點後才營業,不要寫上午/一早去做醫美**`;

const VISION_SYSTEM = `你是專業的廣告構圖分析師。分析使用者上傳的構圖參考圖,輸出 (1) 一段中文構圖描述 prompt 給生圖 AI 模仿,(2) 偵測是否有人物,(3) 若有人物簡述其外觀。

**輸出 JSON 格式 (嚴格遵守,不要任何 markdown)**:
{
  "composition_prompt": "繁體中文構圖描述,80-150 字。必須涵蓋:鏡頭角度(俯/平/仰) / 視線高度 / 主體位置(置中/偏左/偏右/三分構圖) / 留白方向 / 光源方向 / 景深(淺/深) / 排版佈局 / 視覺風格 / 色調氛圍。**只描述構圖元素,不要寫具體的物件或人物身分**(因為我們只模仿構圖,不抄產品)。範例:「45 度俯角中近景,主體置於畫面中央偏右,佔三分之二,淺景深背景虛化。光源來自左上方暖色自然光,形成明顯高光與陰影層次。色調以暖橘金為主,搭配冷色背景對比。整體採用美食攝影風格,構圖飽滿少留白。」",
  "has_person": true,
  "person_description": "中文一句話描述人物:性別 / 年齡感 / 穿著風格 / 姿勢 / 表情 / 與鏡頭關係 (≤40 字)。若 has_person=false 此欄回空字串"
}`;

function tolerantParse(text) {
  let s = (text || '').trim();
  const block = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (block) s = block[1].trim();
  try { return JSON.parse(s); } catch (_) {}
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch (_) {}
  }
  throw new Error('Failed to parse JSON: ' + s.slice(0, 200));
}

async function fetchAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch image HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  let mediaType = 'image/jpeg';
  if (/png/i.test(ct)) mediaType = 'image/png';
  else if (/webp/i.test(ct)) mediaType = 'image/webp';
  else if (/gif/i.test(ct)) mediaType = 'image/gif';
  else if (/jpeg|jpg/i.test(ct)) mediaType = 'image/jpeg';
  // fallback: 看 URL 副檔名
  if (mediaType === 'image/jpeg') {
    if (/\.png(\?|$)/i.test(url)) mediaType = 'image/png';
    else if (/\.webp(\?|$)/i.test(url)) mediaType = 'image/webp';
    else if (/\.gif(\?|$)/i.test(url)) mediaType = 'image/gif';
  }
  return { data: buf.toString('base64'), media_type: mediaType };
}

async function analyzeComposition(imageUrl) {
  try {
    const { data, media_type } = await fetchAsBase64(imageUrl);
    const resp = await client().messages.create({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.4,
      system: VISION_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data } },
          { type: 'text', text: '請分析這張構圖參考圖,輸出 JSON (不要 markdown)。' },
        ],
      }],
    });
    const text = resp.content.map((b) => b.text || '').join('');
    const parsed = tolerantParse(text);
    return {
      composition_prompt: parsed.composition_prompt || '',
      has_person: !!parsed.has_person,
      person_description: parsed.person_description || '',
    };
  } catch (e) {
    console.error('[analyzeComposition] failed:', e.message);
    return {
      composition_prompt: '',
      has_person: false,
      person_description: '',
      composition_error: e.message, // debug 用,正常情況不會塞
    };
  }
}

async function suggestCopy({ product, brand, brand_persona, audience, industry, clinic, materialType }) {
  const medical = isMedical(industry);
  const promo = materialType === 'promo';
  const clinicText = medical ? clinicContextText(clinic) : '';
  const user = `**品牌**: ${brand || '(未提供)'}
**品牌人格**: ${brand_persona || '(未提供)'}
**受眾**: ${audience || '(一般大眾)'}
${clinicText ? `\n**診所資訊**:\n${clinicText}\n` : ''}
**${medical ? '療程名' : '產品名'}**: ${product.name}
**${medical ? '療程特色' : '產品特色'}**:
${product.features || '(未提供)'}
${product.promo_offer ? `**價格/優惠**: ${product.promo_offer}` : ''}
${product.image_focus ? `**視覺方向偏好**: ${product.image_focus}` : ''}
${medical && promo ? '\n**素材類型**: 促銷型(要催單、帶價格/優惠/名額/CTA)' : ''}

請出 3 個差異化標題 + 1 個副標 + 短版圖中文案 + 長版圖中文案 + 完整貼文文案。直接回 JSON,不要任何前後說明。`;

  const system = medical
    ? (promo ? SUGGEST_SYSTEM_MEDICAL_PROMO : SUGGEST_SYSTEM_MEDICAL)
    : SUGGEST_SYSTEM;
  const parsed = await callJSON({
    system, user, maxTokens: 2000, temperature: 0.9,
  });
  if (!Array.isArray(parsed.titles) || parsed.titles.length < 1) {
    throw new Error('LLM 回傳格式錯誤:缺少 titles 陣列');
  }
  return parsed;
}

export async function POST(req) {
  try {
    const { product, brand, brand_persona, audience, compositionRefUrl, dry_run, industry = 'general', clinic = null, materialType = 'brand' } = await req.json();
    if (!product?.name) {
      return NextResponse.json({ error: '產品資訊不足' }, { status: 400 });
    }

    const medical = isMedical(industry);
    const promo = materialType === 'promo';

    if (dry_run) {
      return NextResponse.json(medical ? (promo ? {
        titles: [`${product.name} 限時價`, `首團只接兩組`, `5,000 券直接抵`],
        subtitle: `[Dry-run] 2-3 人 8,399/人起`,
        copy_short: `[Dry-run short] ${product.name}，每人 5,000 券直接抵`,
        copy_long: `[Dry-run long] ${product.name}，名額有限、私訊卡位；中文全程陪同、費用透明`,
        copy: `[Dry-run promo] ${brand || ''} 導購文案。\n\n#醫美 #曼谷 #限時`,
        composition_prompt: compositionRefUrl ? 'Dry-run composition: bold promo beauty layout.' : '',
        has_person: true,
        person_description: '',
      } : {
        titles: [`${product.name} 的自然感`, `還在為鬆弛煩惱？`, `曼谷旅遊順便變美`],
        subtitle: `[Dry-run] ${product.features?.slice(0, 30) || ''}`,
        copy_short: `[Dry-run short] ${product.name}，自然、安心`,
        copy_long: `[Dry-run long] ${product.name}，中文全程陪同、費用透明，每人 5,000 醫美券直接抵`,
        copy: `[Dry-run] 完整文案，${brand || ''} 風格。\n\n#醫美 #曼谷`,
        composition_prompt: compositionRefUrl ? 'Dry-run composition: soft beauty close-up, natural window light.' : '',
        has_person: true,
        person_description: '',
      }) : {
        titles: [`${product.name} 來了`, `為什麼要選${product.name}`, `今晚就吃 ${product.name}`],
        subtitle: `[Dry-run] ${product.features?.slice(0, 30) || ''}`,
        copy_short: `[Dry-run short] ${product.name} 必吃`,
        copy_long: `[Dry-run long] ${product.name},${brand_persona || ''} 風格主打,優惠進行中`,
        copy: `[Dry-run] 完整文案,${brand || ''} 風格。\n\n#dryrun`,
        composition_prompt: compositionRefUrl ? 'Dry-run composition: medium close-up, top-down 30 deg, soft side light.' : '',
        has_person: false,
        person_description: '',
      });
    }

    // 並行跑 (1) 文案生成 (2) 視覺分析 (若有 compositionRefUrl)
    const [copyResult, visionResult] = await Promise.all([
      suggestCopy({ product, brand, brand_persona, audience, industry, clinic, materialType }),
      compositionRefUrl
        ? analyzeComposition(compositionRefUrl).catch(() => ({ composition_prompt: '', has_person: false, person_description: '' }))
        : Promise.resolve({ composition_prompt: '', has_person: false, person_description: '' }),
    ]);

    return NextResponse.json({
      titles: copyResult.titles.slice(0, 3),
      subtitle: copyResult.subtitle || '',
      copy_short: copyResult.copy_short || '',
      copy_long: copyResult.copy_long || '',
      copy: copyResult.copy || '',
      composition_prompt: visionResult.composition_prompt,
      has_person: visionResult.has_person,
      person_description: visionResult.person_description,
      composition_error: visionResult.composition_error || '',
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
