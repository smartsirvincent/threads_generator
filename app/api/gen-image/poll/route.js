// Step 2/3: single-poll KIE V2 recordInfo (~1-2s)
// 客戶端自己決定 retry 間隔
import { NextResponse } from 'next/server';

const KIE_BASE = 'https://api.kie.ai/api/v1';

function key() {
  const k = process.env.KIE_API_KEY;
  if (!k) throw new Error('KIE_API_KEY not set');
  return k;
}

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const taskId = url.searchParams.get('taskId');
    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }
    const res = await fetch(`${KIE_BASE}/jobs/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${key()}` },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { state: 'fail', error: `KIE poll HTTP ${res.status}: ${text.slice(0, 200)}` },
        { status: 200 }, // 回 200 讓 client 看 state,不要 fetch reject
      );
    }
    const json = await res.json();
    const d = json.data;
    if (!d) {
      return NextResponse.json({ state: 'generating' });
    }
    if (d.state === 'success') {
      try {
        const r = JSON.parse(d.resultJson || '{}');
        const urls = r.resultUrls || r.result_urls;
        if (urls && urls.length > 0) {
          return NextResponse.json({ state: 'success', kieUrl: urls[0] });
        }
        return NextResponse.json({ state: 'fail', error: 'done but no URL' });
      } catch (e) {
        return NextResponse.json({ state: 'fail', error: `parse: ${e.message}` });
      }
    }
    if (d.state === 'fail') {
      return NextResponse.json({
        state: 'fail',
        error: d.failMsg || d.failCode || 'unknown',
      });
    }
    return NextResponse.json({ state: 'generating' });
  } catch (e) {
    return NextResponse.json({ state: 'fail', error: e.message }, { status: 200 });
  }
}
