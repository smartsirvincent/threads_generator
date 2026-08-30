// Claude API wrapper — 統一處理 JSON 模式呼叫
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

let _client = null;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY not set.\n' +
        '請在 threads-generator/.env 加入:\n' +
        '  ANTHROPIC_API_KEY=sk-ant-...\n' +
        '或在 PowerShell 跑: $env:ANTHROPIC_API_KEY="sk-ant-..."'
      );
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

/**
 * 呼叫 Claude,要求回傳 JSON。會自動處理 ```json``` 包裝
 */
export async function callJSON({ system, user, maxTokens = 8000, temperature = 0.9 }) {
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const text = resp.content.map(b => b.text || '').join('');

  // 嘗試抽出 JSON
  let jsonStr = text.trim();
  const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) jsonStr = codeBlock[1].trim();
  else jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim(); // 沒有結尾圍欄(截斷)也要去掉開頭

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // 再試:抓第一個 { 到最後一個 }
    const first = jsonStr.indexOf('{');
    const firstArr = jsonStr.indexOf('[');
    const start = firstArr >= 0 && (first < 0 || firstArr < first) ? firstArr : first;
    const lastObj = jsonStr.lastIndexOf('}');
    const lastArr = jsonStr.lastIndexOf(']');
    const end = Math.max(lastObj, lastArr);
    if (start >= 0 && end > start) {
      try { return JSON.parse(jsonStr.slice(start, end + 1)); } catch (_) {}
    }
    // 搶救被截斷的 {"topics":[ {..},{..},{..(不完整) → 只保留到最後一個完整物件
    const salvaged = salvageTruncated(jsonStr);
    if (salvaged) return salvaged;
    throw new Error(`Failed to parse JSON from Claude:\n${text.slice(0, 500)}...`);
  }
}

// 針對 {"topics":[{...},{...},{...(截斷) 這種:切到最後一個 "}," 前的完整物件,再補上 ]}
function salvageTruncated(s) {
  const arrStart = s.indexOf('[');
  if (arrStart < 0) return null;
  const cut = s.lastIndexOf('},');
  if (cut < 0) return null;
  const head = s.slice(0, cut + 1); // 到最後一個完整物件的 }
  for (const suffix of [']}', ']', '}]}', '}']) {
    try { return JSON.parse(head + suffix); } catch (_) {}
  }
  return null;
}

export function modelName() { return MODEL; }
