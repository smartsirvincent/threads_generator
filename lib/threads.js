// Threads 發文 + 發文 log + 排程佇列 的共用伺服器邏輯(給 /api/threads/post、/api/queue、/api/cron 用)
import crypto from 'crypto';
import { uploadRawToCloudinary, listRawResources, hasCloudinary, hasAdminCloudinary } from '@/lib/cloudinary.js';

const BASE = 'https://graph.threads.net/v1.0';
const LOG_ID = 'threads-generator/postlog/best-friend';
const LOG_PREFIX = 'threads-generator/postlog/';
const QUEUE_ID = 'threads-generator/queue/best-friend';
const QUEUE_PREFIX = 'threads-generator/queue/';
const PRICE_ID = 'threads-generator/pricechanges/best-friend';
const PRICE_PREFIX = 'threads-generator/pricechanges/';
const SETTINGS_ID = 'threads-generator/settings/best-friend';
const SETTINGS_PREFIX = 'threads-generator/settings/';
const AUTH_ID = 'threads-generator/threadsauth/best-friend';
const AUTH_PREFIX = 'threads-generator/threadsauth/';

const DAY = 86400000;
const LONG_LIVED_MS = 60 * DAY; // Threads 長效 token 效期約 60 天

// ── token 靜態加密(有設 TOKEN_SECRET 才加密,否則明文存;讓最敏感的憑證不至於裸放在雲端 JSON) ──
function encToken(text) {
  const key = process.env.TOKEN_SECRET;
  if (!key || !text) return { v: text || '', enc: false };
  const k = crypto.createHash('sha256').update(key).digest();
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return { v: Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64'), enc: true };
}
function decToken(stored) {
  if (!stored) return '';
  if (!stored.enc) return stored.v || '';
  const key = process.env.TOKEN_SECRET;
  if (!key) return ''; // 無金鑰無法解密
  try {
    const k = crypto.createHash('sha256').update(key).digest();
    const raw = Buffer.from(stored.v, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  } catch (_) { return ''; }
}

// 雲端存的 Threads 憑證(跨裝置、不需重新部署)
export async function readThreadsAuth() {
  const d = await readDoc(AUTH_PREFIX, 'best-friend').catch(() => null);
  return (d && typeof d === 'object' && d.userId) ? d : null;
}
export async function writeThreadsAuth(auth) {
  if (!hasCloudinary()) throw new Error('Cloudinary 未設定');
  const buffer = Buffer.from(JSON.stringify(auth || {}, null, 2), 'utf-8');
  await uploadRawToCloudinary(buffer, { publicId: AUTH_ID, filename: 'threadsauth.json', overwrite: true });
}
// 儲存憑證(token 進來是明文,存前自動加密)
export async function saveThreadsAuth({ userId, token, username = '', expiresTs = 0 }) {
  const now = Date.now();
  const prev = await readThreadsAuth().catch(() => null);
  await writeThreadsAuth({
    userId: String(userId).trim(),
    token: encToken(String(token).trim()),
    username,
    expiresTs: expiresTs || (now + LONG_LIVED_MS),
    updatedTs: now,
    lastRefreshTs: prev?.lastRefreshTs || 0,
    refreshError: '',
  });
}
export async function clearThreadsAuth() { await writeThreadsAuth({}); }

// 取得可用憑證:優先雲端,退回環境變數(向下相容)
export async function getThreadsCreds() {
  try {
    const a = await readThreadsAuth();
    if (a?.userId && a?.token) {
      const token = decToken(a.token);
      if (token) return { userId: a.userId, token, ok: true, source: 'cloud', expiresTs: a.expiresTs || 0 };
    }
  } catch (_) {}
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  return { userId, token, ok: !!(userId && token), source: 'env', expiresTs: 0 };
}
// 舊的同步版(僅環境變數)保留給尚未改的呼叫端
export function threadsCreds() {
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  return { userId, token, ok: !!(userId && token) };
}

// 驗證 token 是否有效,回 { id, username }
export async function validateThreadsToken(token) {
  const qs = new URLSearchParams({ fields: 'id,username', access_token: token }).toString();
  const r = await fetch(`${BASE}/me?${qs}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `HTTP ${r.status}`);
  return { id: d.id || '', username: d.username || '' };
}
// 用現有長效 token 換一顆新的(效期重新計 60 天;token 需已存在 >24h)
export async function refreshThreadsToken(token) {
  const qs = new URLSearchParams({ grant_type: 'th_refresh_token', access_token: token }).toString();
  const r = await fetch(`https://graph.threads.net/refresh_access_token?${qs}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error(d?.error?.message || `HTTP ${r.status}`);
  return { access_token: d.access_token, expiresIn: Number(d.expires_in) || (60 * 86400) };
}
// cron 每日呼叫:剩 <thresholdDays 天(預設 10)就自動續期;force 則不管剩幾天都續
export async function maybeRefreshThreadsToken({ thresholdDays = 10, force = false } = {}) {
  const a = await readThreadsAuth();
  if (!a?.userId || !a?.token) return { refreshed: false, reason: 'no-cloud-token' };
  const token = decToken(a.token);
  if (!token) return { refreshed: false, reason: 'cannot-decrypt' };
  const now = Date.now();
  const expiresTs = a.expiresTs || 0;
  const daysLeft = expiresTs ? Math.round((expiresTs - now) / DAY) : null;
  if (!force && expiresTs && (expiresTs - now) > thresholdDays * DAY) {
    return { refreshed: false, reason: 'not-due', daysLeft };
  }
  try {
    const { access_token, expiresIn } = await refreshThreadsToken(token);
    await writeThreadsAuth({ ...a, token: encToken(access_token), expiresTs: now + expiresIn * 1000, lastRefreshTs: now, refreshError: '' });
    return { refreshed: true, daysLeft, newDaysLeft: Math.round(expiresIn / 86400) };
  } catch (e) {
    await writeThreadsAuth({ ...a, refreshError: String(e.message).slice(0, 200) });
    return { refreshed: false, reason: 'error', error: String(e.message).slice(0, 200), daysLeft };
  }
}

async function tPost(path, params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/${path}?${qs}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

// 發一則貼文(有 imageUrl 則發圖文,否則純文字),回 { mediaId, permalink }
export async function publishThreads(text, imageUrl = '') {
  const { userId, token, ok } = await getThreadsCreds();
  if (!ok) throw new Error('Threads 尚未設定(請到「連線設定」設定,或填環境變數)');
  const body = (text || '').trim();
  if (!body && !imageUrl) throw new Error('內容空白');
  if (body.length > 500) throw new Error('超過 500 字');
  const createParams = imageUrl
    ? { media_type: 'IMAGE', image_url: imageUrl, text: body, access_token: token }
    : { media_type: 'TEXT', text: body, access_token: token };
  const created = await tPost(`${userId}/threads`, createParams);
  if (!created.id) throw new Error('建立容器失敗');
  const published = await tPost(`${userId}/threads_publish`, { creation_id: created.id, access_token: token });
  const mediaId = published.id;
  let permalink = '';
  try {
    const qs = new URLSearchParams({ fields: 'permalink', access_token: token }).toString();
    const r = await fetch(`${BASE}/${mediaId}?${qs}`);
    const d = await r.json();
    permalink = d?.permalink || '';
  } catch (_) {}
  return { mediaId, permalink };
}
// 相容舊呼叫:純文字
export async function publishThreadsText(text) { return publishThreads(text, ''); }

async function readDoc(prefix, includes) {
  if (!hasAdminCloudinary()) return null;
  const list = await listRawResources({ prefix });
  const match = list.find((r) => (r.public_id || '').includes(includes));
  if (!match?.secure_url) return null;
  const r = await fetch(match.secure_url, { cache: 'no-store' });
  if (!r.ok) return null;
  return r.json();
}

export async function readPostLog() {
  const d = await readDoc(LOG_PREFIX, 'best-friend').catch(() => null);
  return Array.isArray(d?.entries) ? d.entries : [];
}
export async function appendPostLog(entry) {
  if (!hasCloudinary()) return;
  const entries = await readPostLog();
  entries.unshift(entry);
  const buffer = Buffer.from(JSON.stringify({ entries: entries.slice(0, 3000) }, null, 2), 'utf-8');
  await uploadRawToCloudinary(buffer, { publicId: LOG_ID, filename: 'postlog.json', overwrite: true });
}

export async function readQueue() {
  const d = await readDoc(QUEUE_PREFIX, 'best-friend').catch(() => null);
  return Array.isArray(d?.items) ? d.items : [];
}
export async function writeQueue(items) {
  if (!hasCloudinary()) throw new Error('Cloudinary 未設定');
  const buffer = Buffer.from(JSON.stringify({ items: items.slice(0, 3000), savedAt: Date.now() }, null, 2), 'utf-8');
  await uploadRawToCloudinary(buffer, { publicId: QUEUE_ID, filename: 'queue.json', overwrite: true });
}

// 價格異動紀錄:{name, from, to, ts}。/brand 存檔時記錄,更新未發內容時套用。
export async function readPriceChanges() {
  const d = await readDoc(PRICE_PREFIX, 'best-friend').catch(() => null);
  return Array.isArray(d?.changes) ? d.changes : [];
}
export async function writePriceChanges(changes) {
  if (!hasCloudinary()) throw new Error('Cloudinary 未設定');
  const buffer = Buffer.from(JSON.stringify({ changes: changes.slice(0, 500), savedAt: Date.now() }, null, 2), 'utf-8');
  await uploadRawToCloudinary(buffer, { publicId: PRICE_ID, filename: 'pricechanges.json', overwrite: true });
}

// 設定(每日自動產文開關等)
export async function readSettings() {
  const d = await readDoc(SETTINGS_PREFIX, 'best-friend').catch(() => null);
  return (d && typeof d === 'object') ? d : { dailyAuto: false, lastAutoTs: 0 };
}
export async function writeSettings(s) {
  if (!hasCloudinary()) throw new Error('Cloudinary 未設定');
  const buffer = Buffer.from(JSON.stringify(s, null, 2), 'utf-8');
  await uploadRawToCloudinary(buffer, { publicId: SETTINGS_ID, filename: 'settings.json', overwrite: true });
}

// 每週排程範本(週期性):slots = [{id, weekday(0-6), time 'HH:MM', topicId}]
const WEEKLY_ID = 'threads-generator/weekly/best-friend';
const WEEKLY_PREFIX = 'threads-generator/weekly/';
export async function readWeekly() {
  const d = await readDoc(WEEKLY_PREFIX, 'best-friend').catch(() => null);
  return Array.isArray(d?.slots) ? d.slots : [];
}
export async function writeWeekly(slots) {
  if (!hasCloudinary()) throw new Error('Cloudinary 未設定');
  const buffer = Buffer.from(JSON.stringify({ slots: (slots || []).slice(0, 500), savedAt: Date.now() }, null, 2), 'utf-8');
  await uploadRawToCloudinary(buffer, { publicId: WEEKLY_ID, filename: 'weekly.json', overwrite: true });
}

// 主題庫(讀,給 cron 挑主題用)
export async function readTopics() {
  const d = await readDoc('threads-generator/topics/', 'best-friend').catch(() => null);
  return Array.isArray(d?.topics) ? d.topics : [];
}

// 品牌固定槽(讀,給 cron 帶入品牌/診所)
export async function readCanonicalProfile() {
  return readDoc('threads-generator/profiles/', '泰國醫美_Best_Friend').catch(() => null);
}
