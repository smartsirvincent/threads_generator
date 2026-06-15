// Cloudinary 上傳:支援 signed (api_key+secret) 與 unsigned (upload_preset) 兩種模式
// docs: https://cloudinary.com/documentation/upload_images
import crypto from 'node:crypto';

function cloudName() {
  const n = process.env.CLOUDINARY_CLOUD_NAME;
  if (!n) throw new Error('CLOUDINARY_CLOUD_NAME not set in .env');
  return n;
}

function uploadMode() {
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (preset) return { mode: 'unsigned', preset };
  if (apiKey && apiSecret) return { mode: 'signed', apiKey, apiSecret };
  throw new Error(
    'Cloudinary credentials missing.\n' +
    '請在 .env 設定其中一種:\n' +
    '  (A) Unsigned: CLOUDINARY_UPLOAD_PRESET=ml_default (或你建立的 preset)\n' +
    '  (B) Signed:   CLOUDINARY_API_KEY=... + CLOUDINARY_API_SECRET=...'
  );
}

function sign(params, apiSecret) {
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(sorted + apiSecret).digest('hex');
}

/**
 * 上傳 Buffer 或 URL 到 Cloudinary,回傳 secure_url
 * @param {Buffer|string} source — Buffer 或 URL 字串
 * @param {object} [opts]
 * @param {string} [opts.folder] — Cloudinary 資料夾 (例如 'threads-generator')
 * @param {string} [opts.publicId] — 自訂 public_id (省略則 Cloudinary 隨機產)
 * @returns {Promise<{url:string, publicId:string}>}
 */
export async function uploadToCloudinary(source, opts = {}) {
  const mode = uploadMode();
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName()}/image/upload`;

  const form = new FormData();
  if (Buffer.isBuffer(source)) {
    form.append('file', new Blob([source], { type: 'image/png' }), 'image.png');
  } else {
    form.append('file', String(source));
  }
  if (opts.folder) form.append('folder', opts.folder);
  if (opts.publicId) form.append('public_id', opts.publicId);

  if (mode.mode === 'unsigned') {
    form.append('upload_preset', mode.preset);
  } else {
    const timestamp = Math.floor(Date.now() / 1000);
    const signParams = { timestamp };
    if (opts.folder) signParams.folder = opts.folder;
    if (opts.publicId) signParams.public_id = opts.publicId;
    const signature = sign(signParams, mode.apiSecret);
    form.append('timestamp', String(timestamp));
    form.append('api_key', mode.apiKey);
    form.append('signature', signature);
  }

  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.secure_url) throw new Error(`Cloudinary no secure_url: ${JSON.stringify(data)}`);
  return { url: data.secure_url, publicId: data.public_id };
}

/**
 * 是否已設定 Cloudinary credentials
 */
export function hasCloudinary() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) return false;
  if (process.env.CLOUDINARY_UPLOAD_PRESET) return true;
  if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) return true;
  return false;
}

/**
 * 是否有 signed (admin) credentials,可用 list / delete API
 */
export function hasAdminCloudinary() {
  return !!(process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET);
}

function adminAuth() {
  const k = process.env.CLOUDINARY_API_KEY;
  const s = process.env.CLOUDINARY_API_SECRET;
  if (!k || !s) throw new Error('Cloudinary admin API needs CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET');
  return 'Basic ' + Buffer.from(`${k}:${s}`).toString('base64');
}

/**
 * 列出某個 prefix 下的所有 raw 資源
 *
 * 用 list API (resources/raw) 而非 search API:
 * - search API 對 raw resources 索引落後/不一致 (實測會 return 0),
 *   而 list API 是直接掃 storage,結果即時且可靠
 *
 * @param {object} opts
 * @param {string} opts.prefix - Cloudinary public_id prefix
 * @param {number} [opts.maxResults=100]
 * @returns {Promise<Array<{public_id, secure_url, bytes, created_at, format}>>}
 */
export async function listRawResources({ prefix, maxResults = 100 }) {
  const listUrl = `https://api.cloudinary.com/v1_1/${cloudName()}/resources/raw`
    + `?prefix=${encodeURIComponent(prefix)}`
    + `&max_results=${maxResults}`
    + `&type=upload`;
  const res = await fetch(listUrl, { headers: { 'Authorization': adminAuth() } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary list HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.resources || [];
}

/**
 * 刪除一個 raw 資源 by public_id
 */
export async function deleteRawResource(publicId) {
  const url = `https://api.cloudinary.com/v1_1/${cloudName()}/resources/raw/upload`
    + `?public_ids[]=${encodeURIComponent(publicId)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': adminAuth() },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary delete HTTP ${res.status}: ${text}`);
  }
  return await res.json();
}

/**
 * 上傳 xlsx (或其他非圖片) 為 raw resource
 * 回傳直接可下載的 URL
 */
export async function uploadRawToCloudinary(buffer, { folder, publicId, filename = 'output.xlsx', overwrite = false } = {}) {
  const mode = uploadMode();
  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName()}/raw/upload`;

  const form = new FormData();
  // xlsx mime
  const mime = filename.endsWith('.xlsx')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/octet-stream';
  form.append('file', new Blob([buffer], { type: mime }), filename);
  if (folder) form.append('folder', folder);
  if (publicId) form.append('public_id', publicId);
  if (overwrite) {
    form.append('overwrite', 'true');
    form.append('invalidate', 'true'); // 清 CDN cache,讓新內容立即可見
  }

  if (mode.mode === 'unsigned') {
    form.append('upload_preset', mode.preset);
  } else {
    const timestamp = Math.floor(Date.now() / 1000);
    const signParams = { timestamp };
    if (folder) signParams.folder = folder;
    if (publicId) signParams.public_id = publicId;
    if (overwrite) {
      signParams.overwrite = 'true';
      signParams.invalidate = 'true';
    }
    const signature = sign(signParams, mode.apiSecret);
    form.append('timestamp', String(timestamp));
    form.append('api_key', mode.apiKey);
    form.append('signature', signature);
  }

  const res = await fetch(endpoint, { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary raw upload HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.secure_url) throw new Error(`Cloudinary no secure_url: ${JSON.stringify(data)}`);
  return { url: data.secure_url, publicId: data.public_id, bytes: data.bytes };
}
