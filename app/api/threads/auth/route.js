// Threads 連線設定:GET 回連線狀態(帳號/到期/最後續期);POST 儲存憑證 / 立即續期 / 解除
import { NextResponse } from 'next/server';
import {
  readThreadsAuth, saveThreadsAuth, clearThreadsAuth, getThreadsCreds,
  validateThreadsToken, refreshThreadsToken, maybeRefreshThreadsToken,
} from '@/lib/threads.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DAY = 86400000;

async function status() {
  const a = await readThreadsAuth().catch(() => null);
  const creds = await getThreadsCreds();
  const now = Date.now();
  const expiresTs = a?.expiresTs || 0;
  return {
    configured: creds.ok,
    source: creds.source,               // 'cloud' | 'env'
    username: a?.username || '',
    userId: a?.userId || (creds.source === 'env' ? creds.userId : '') || '',
    expiresTs,
    daysLeft: expiresTs ? Math.round((expiresTs - now) / DAY) : null,
    lastRefreshTs: a?.lastRefreshTs || 0,
    refreshError: a?.refreshError || '',
    encrypted: !!a?.token?.enc,
    encAvailable: !!process.env.TOKEN_SECRET,
  };
}

export async function GET() {
  try { return NextResponse.json(await status()); }
  catch (e) { return NextResponse.json({ error: e.message }, { status: 500 }); }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const action = body.action || 'save';
  try {
    if (action === 'test') {
      const c = await getThreadsCreds();
      if (!c.ok) return NextResponse.json({ ok: false, error: '尚未設定 Threads 連線' }, { status: 400 });
      try {
        const info = await validateThreadsToken(c.token);
        return NextResponse.json({ ok: true, username: info.username, id: info.id, source: c.source });
      } catch (e) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
      }
    }
    if (action === 'refresh') {
      const r = await maybeRefreshThreadsToken({ force: true });
      return NextResponse.json({ ...r, status: await status() });
    }
    if (action === 'clear') {
      await clearThreadsAuth();
      return NextResponse.json({ ok: true, cleared: true, status: await status() });
    }
    // save
    const userId = String(body.userId || '').trim();
    const accessToken = String(body.accessToken || '').trim();
    if (!userId || !accessToken) return NextResponse.json({ error: '請填 User ID 與 Access Token' }, { status: 400 });

    // 1) 先驗證 token 可用,順便拿 username
    let info = { username: '' };
    try { info = await validateThreadsToken(accessToken); }
    catch (e) { return NextResponse.json({ error: `Token 驗證失敗:${e.message}` }, { status: 400 }); }

    // 2) 嘗試立即續期以取得精準效期(舊 token >24h 會成功;全新 token 會失敗→退回 60 天估計)
    let finalToken = accessToken;
    let expiresTs = Date.now() + 60 * DAY;
    try {
      const { access_token, expiresIn } = await refreshThreadsToken(accessToken);
      finalToken = access_token;
      expiresTs = Date.now() + expiresIn * 1000;
    } catch (_) { /* 全新 token 尚不可續期,沿用並以 60 天估計 */ }

    await saveThreadsAuth({ userId, token: finalToken, username: info.username, expiresTs });
    return NextResponse.json({ ok: true, username: info.username, status: await status() });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
