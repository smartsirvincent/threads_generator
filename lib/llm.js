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
    throw new Error(`Failed to parse JSON from Claude:\n${text.slice(0, 500)}...`);
  }
}

export function modelName() { return MODEL; }
