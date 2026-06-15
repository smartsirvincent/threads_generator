// 素材產生器 Step 2:Claude 出標題+文案建議
// 若有 compositionRefUrl,額外用 Claude vision 分析構圖 + 偵測人物
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { callJSON } from '@/lib/llm.js';

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

async function suggestCopy({ product, brand, brand_persona, audience }) {
  const user = `**品牌**: ${brand || '(未提供)'}
**品牌人格**: ${brand_persona || '(未提供)'}
**受眾**: ${audience || '(一般大眾)'}

**產品名**: ${product.name}
**產品特色**:
${product.features || '(未提供)'}
${product.promo_offer ? `**優惠/活動**: ${product.promo_offer}` : ''}
${product.image_focus ? `**視覺方向偏好**: ${product.image_focus}` : ''}

請出 3 個差異化標題 + 1 個副標 + 短版圖中文案 + 長版圖中文案 + 完整貼文文案。直接回 JSON,不要任何前後說明。`;

  const parsed = await callJSON({
    system: SUGGEST_SYSTEM, user, maxTokens: 2000, temperature: 0.9,
  });
  if (!Array.isArray(parsed.titles) || parsed.titles.length < 1) {
    throw new Error('LLM 回傳格式錯誤:缺少 titles 陣列');
  }
  return parsed;
}

export async function POST(req) {
  try {
    const { product, brand, brand_persona, audience, compositionRefUrl, dry_run } = await req.json();
    if (!product?.name) {
      return NextResponse.json({ error: '產品資訊不足' }, { status: 400 });
    }

    if (dry_run) {
      return NextResponse.json({
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
      suggestCopy({ product, brand, brand_persona, audience }),
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
