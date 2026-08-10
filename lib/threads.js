// Threads 發文 + 發文 log + 排程佇列 的共用伺服器邏輯(給 /api/threads/post、/api/queue、/api/cron 用)
import { uploadRawToCloudinary, listRawResources, hasCloudinary, hasAdminCloudinary } from '@/lib/cloudinary.js';

const BASE = 'https://graph.threads.net/v1.0';
const LOG_ID = 'threads-generator/postlog/best-friend';
const LOG_PREFIX = 'threads-generator/postlog/';
const QUEUE_ID = 'threads-generator/queue/best-friend';
const QUEUE_PREFIX = 'threads-generator/queue/';
const PRICE_ID = 'threads-generator/pricechanges/best-friend';
const PRICE_PREFIX = 'threads-generator/pricechanges/';

export function threadsCreds() {
  const userId = process.env.THREADS_USER_ID;
  const token = process.env.THREADS_ACCESS_TOKEN;
  return { userId, token, ok: !!(userId && token) };
}

async function tPost(path, params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/${path}?${qs}`, { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

// 發一則純文字貼文,回 { mediaId, permalink }
export async function publishThreadsText(text) {
  const { userId, token, ok } = threadsCreds();
  if (!ok) throw new Error('Threads 尚未設定(缺 THREADS_USER_ID / THREADS_ACCESS_TOKEN)');
  const body = (text || '').trim();
  if (!body) throw new Error('內容空白');
  if (body.length > 500) throw new Error('超過 500 字');
  const created = await tPost(`${userId}/threads`, { media_type: 'TEXT', text: body, access_token: token });
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
