const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24h

export const storage = {
  get(key) {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`is_${key}`);
      if (!raw) return null;
      const { value, expiry } = JSON.parse(raw);
      if (expiry && Date.now() > expiry) {
        localStorage.removeItem(`is_${key}`);
        return null;
      }
      return value;
    } catch { return null; }
  },

  set(key, value, ttl = DEFAULT_TTL) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`is_${key}`, JSON.stringify({
        value,
        expiry: ttl ? Date.now() + ttl : null,
        savedAt: new Date().toISOString(),
      }));
    } catch {
      this.evictOldest();
      try { localStorage.setItem(`is_${key}`, JSON.stringify({ value, expiry: ttl ? Date.now() + ttl : null })); }
      catch { /* give up */ }
    }
  },

  remove(key) {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(`is_${key}`);
  },

  evictOldest() {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('is_')) {
        try {
          const { expiry } = JSON.parse(localStorage.getItem(k));
          entries.push({ key: k, expiry: expiry || 0 });
        } catch { entries.push({ key: k, expiry: 0 }); }
      }
    }
    entries.sort((a, b) => a.expiry - b.expiry);
    entries.slice(0, 10).forEach((e) => localStorage.removeItem(e.key));
  },
};

// Named exports for api.js compatibility (api passes TTL in seconds)
export function storageGet(key) { return storage.get(key); }
export function storageSet(key, value, ttlSeconds) {
  storage.set(key, value, ttlSeconds ? ttlSeconds * 1000 : null);
}
