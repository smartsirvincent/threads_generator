// 素材產生器 Step 2:Claude 根據產品出標題+文案建議
import { NextResponse } from 'next/server';
import { callJSON } from '@/lib/llm.js';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SYSTEM = `你是專精台灣社群素材文案的策略師,擅長為單張視覺廣告寫主標 + 副標 + 一句文案。

**輸出 JSON 格式 (嚴格遵守)**:
{
  "titles": [
    "標題 1 (≤12 字,直接、霸氣或療癒,看品牌人格而定)",
    "標題 2 (角度不同,例如問題式)",
    "標題 3 (角度不同,例如情境式)"
  ],
  "subtitle": "副標 (≤20 字,補強標題的承諾或細節)",
  "copy": "完整文案 (60-120 字,適合 IG/FB 貼文,可含換行)"
}

規則:
- 用品牌人格說話,不要 AI 味
- 標題要有差異化,3 個分別走不同角度
- 標題不要超過 12 字 (圖片可讀性)
- 副標可帶優惠/賣點/CTA
- 文案結尾可帶一個 hashtag 或 CTA`;

export async function POST(req) {
  try {
    const { product, brand, brand_persona, audience, dry_run } = await req.json();
    if (!product?.name) {
      return NextResponse.json({ error: '產品資訊不足' }, { status: 400 });
    }

    if (dry_run) {
      return NextResponse.json({
        titles: [
          `${product.name} 來了`,
          `為什麼要選${product.name}`,
          `今晚就吃 ${product.name}`,
        ],
        subtitle: `[Dry-run] ${product.features?.slice(0, 30) || ''}`,
        copy: `[Dry-run] 這是一篇模擬文案,${brand || ''} ${brand_persona || ''} 風格。\n\n${product.name}\n\n#dryrun`,
      });
    }

    const user = `**品牌**: ${brand || '(未提供)'}
**品牌人格**: ${brand_persona || '(未提供)'}
**受眾**: ${audience || '(一般大眾)'}

**產品名**: ${product.name}
**產品特色**:
${product.features || '(未提供)'}
${product.promo_offer ? `**優惠/活動**: ${product.promo_offer}` : ''}
${product.image_focus ? `**視覺方向偏好**: ${product.image_focus}` : ''}

請出 3 個差異化標題 + 1 個副標 + 1 段完整文案。`;

    const result = await callJSON({ system: SYSTEM, user, maxTokens: 2000, temperature: 0.9 });
    if (!Array.isArray(result.titles) || result.titles.length < 1) {
      throw new Error('LLM 回傳格式錯誤:缺少 titles 陣列');
    }
    return NextResponse.json({
      titles: result.titles.slice(0, 3),
      subtitle: result.subtitle || '',
      copy: result.copy || '',
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
