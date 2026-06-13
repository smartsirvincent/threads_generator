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
