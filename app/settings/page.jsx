'use client';

// 連線設定:Threads 連線(網站內設 token,存雲端,60 天效期由 cron 自動續期)
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [auth, setAuth] = useState(null);
  const [authUserId, setAuthUserId] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState('');

  async function loadAuth() {
    try { const r = await fetch('/api/threads/auth', { cache: 'no-store' }); const d = await r.json(); setAuth(d); if (d.userId) setAuthUserId(d.userId); }
    catch (_) { setAuth({ configured: false }); }
  }
  useEffect(() => { loadAuth(); }, []);

  async function saveAuth() {
    if (!authUserId.trim() || !authToken.trim()) { setAuthMsg('請填 User ID 與 Access Token'); return; }
    setAuthBusy(true); setAuthMsg('驗證並儲存中…');
    try {
      const r = await fetch('/api/threads/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save', userId: authUserId.trim(), accessToken: authToken.trim() }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '儲存失敗');
      setAuth(d.status); setAuthToken('');
      setAuthMsg(`✓ 已連接${d.username ? ' @' + d.username : ''}`);
    } catch (e) { setAuthMsg('✗ ' + e.message); } finally { setAuthBusy(false); }
  }
  async function refreshAuth() {
    setAuthBusy(true); setAuthMsg('續期中…');
    try {
      const r = await fetch('/api/threads/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
      const d = await r.json();
      if (d.status) setAuth(d.status);
      setAuthMsg(d.refreshed ? `✓ 已續期,效期重設為約 ${d.newDaysLeft} 天` : `未續期:${d.error || d.reason || ''}`);
    } catch (e) { setAuthMsg('✗ ' + e.message); } finally { setAuthBusy(false); }
  }
  async function clearAuth() {
    if (!confirm('確定解除 Threads 連線?解除後將無法自動發文。')) return;
    setAuthBusy(true); setAuthMsg('解除中…');
    try {
      const r = await fetch('/api/threads/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) });
      const d = await r.json();
      if (d.status) setAuth(d.status);
      setAuthMsg('已解除連線');
    } catch (e) { setAuthMsg('✗ ' + e.message); } finally { setAuthBusy(false); }
  }

  return (
    <main className="space-y-6">
      <div className="card border-brand-200 bg-brand-50/40">
        <h1 className="font-display text-2xl font-semibold text-sand-900">⚙️ 連線設定</h1>
        <p className="mt-2 text-sm text-sand-600">在這裡設定 Threads 連線。存到雲端後,系統會在效期剩 10 天內自動續期(需外部 cron 每小時打 <code>/api/cron/tick</code>),不必再進 Vercel 改設定。</p>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-sand-800">🧵 Threads 連線</h2>
          {auth?.configured
            ? <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">已連接{auth.username ? ' @' + auth.username : ''}</span>
            : <span className="rounded-full bg-gold-50 px-2.5 py-0.5 text-xs font-medium text-gold-700">未連接</span>}
        </div>
        {auth?.configured && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-sand-500">
            {auth.userId ? <span>User ID:<span className="text-sand-700">{auth.userId}</span></span> : null}
            {auth.source === 'env' ? <span className="text-gold-600">來源:環境變數(建議改用下方表單存雲端,才能自動續期)</span> : null}
            {(auth.daysLeft !== null && auth.daysLeft !== undefined) ? <span className={auth.daysLeft <= 10 ? 'font-medium text-red-600' : 'text-sand-600'}>效期剩 {auth.daysLeft} 天{auth.daysLeft <= 10 ? '(即將自動續期)' : ''}</span> : null}
            {auth.lastRefreshTs ? <span>上次續期:{new Date(auth.lastRefreshTs).toLocaleDateString('zh-TW')}</span> : null}
            {auth.source === 'cloud' ? (auth.encrypted ? <span className="text-emerald-600">🔒 已加密</span> : <span className="text-gold-600">未加密(建議在 Vercel 設 TOKEN_SECRET)</span>) : null}
            {auth.refreshError ? <span className="text-red-600">續期錯誤:{auth.refreshError}</span> : null}
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label">Threads User ID（數字）</label>
            <input className="input" value={authUserId} onChange={(e) => setAuthUserId(e.target.value)} placeholder="例:17841400000000000" />
          </div>
          <div>
            <label className="label">Access Token（長效）</label>
            <input className="input" type="password" value={authToken} onChange={(e) => setAuthToken(e.target.value)} placeholder="貼上長效 access token" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={saveAuth} disabled={authBusy} className="btn-primary text-sm disabled:opacity-50">💾 驗證並儲存</button>
          {auth?.configured && auth?.source === 'cloud' ? <button type="button" onClick={refreshAuth} disabled={authBusy} className="btn-secondary text-sm">🔄 立即續期</button> : null}
          {auth?.configured && auth?.source === 'cloud' ? <button type="button" onClick={clearAuth} disabled={authBusy} className="btn-secondary text-sm !text-red-600">解除連線</button> : null}
          {authMsg && <span className="text-xs text-sand-600">{authMsg}</span>}
        </div>
        <p className="text-[11px] leading-relaxed text-sand-400">貼上 <strong>@bestfriend.clinic</strong> 的長效 token（scope 需 threads_basic、threads_content_publish、threads_manage_insights）。Token 只會加密存放,不會顯示原文。</p>
      </div>
    </main>
  );
}
