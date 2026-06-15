// localStorage 存品牌設定 profile
// 結構: { profiles: { [name]: input } , lastUsedName: string }

const KEY = 'threads-gen-profiles';

function safeGet() {
  if (typeof window === 'undefined') return { profiles: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { profiles: {} };
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : { profiles: {} };
  } catch (_) {
    return { profiles: {} };
  }
}

function safeSet(data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (_) {}
}

export function listProfiles() {
  const { profiles = {} } = safeGet();
  return Object.keys(profiles).sort();
}

export function getProfile(name) {
  const { profiles = {} } = safeGet();
  return profiles[name] || null;
}

export function saveProfile(name, input) {
  if (!name || !input) return;
  const data = safeGet();
  data.profiles = data.profiles || {};
  // 不存 dry_run / generate_images (run-time 設定)
  const { dry_run: _dr, generate_images: _gi, ...persistable } = input;
  data.profiles[name] = {
    ...persistable,
    _savedAt: Date.now(),
  };
  data.lastUsedName = name;
  safeSet(data);
}

export function deleteProfile(name) {
  const data = safeGet();
  if (data.profiles && data.profiles[name]) {
    delete data.profiles[name];
    if (data.lastUsedName === name) delete data.lastUsedName;
    safeSet(data);
  }
}

export function getLastUsedName() {
  return safeGet().lastUsedName || null;
}

// ===== 雲端 profile index (緩解 Cloudinary admin API list 的 cache lag) =====

const CLOUD_INDEX_KEY = 'threads-gen-cloud-index';

function safeGetCloudIndex() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CLOUD_INDEX_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (_) {
    return [];
  }
}

function safeSetCloudIndex(arr) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLOUD_INDEX_KEY, JSON.stringify(arr));
  } catch (_) {}
}

export function getCloudIndex() {
  return safeGetCloudIndex();
}

export function addToCloudIndex(entry) {
  if (!entry?.publicId || !entry?.url) return;
  const arr = safeGetCloudIndex().filter((p) => p.publicId !== entry.publicId);
  arr.unshift({ ...entry, createdAt: entry.createdAt || new Date().toISOString() });
  safeSetCloudIndex(arr.slice(0, 200));
}

export function removeFromCloudIndex(publicId) {
  if (!publicId) return;
  const arr = safeGetCloudIndex().filter((p) => p.publicId !== publicId);
  safeSetCloudIndex(arr);
}

/**
 * 合併 localStorage 的 cloud index 與 server 回傳的 list
 * 以 publicId 去重,優先用 server 的版本(較準確)
 * 額外:同 display name 只留最新一筆 (處理舊 hash 殘檔重複)
 */
export function mergeCloudProfiles(serverList = []) {
  const local = safeGetCloudIndex();
  const byId = new Map();
  for (const p of local) byId.set(p.publicId, { ...p, _source: 'local' });
  for (const p of serverList) byId.set(p.publicId, { ...p, _source: 'server' });

  const all = Array.from(byId.values()).sort((a, b) => {
    const aT = new Date(a.createdAt || 0).getTime();
    const bT = new Date(b.createdAt || 0).getTime();
    return bT - aT;
  });

  // 同 display name 只留第一筆 (因為已按 createdAt desc 排序,所以是最新)
  const byName = new Map();
  for (const p of all) {
    const key = (p.name || '').trim();
    if (!key) continue;
    if (!byName.has(key)) byName.set(key, p);
  }
  return Array.from(byName.values());
}
