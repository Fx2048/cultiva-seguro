const KEYS = {
  weather: "willay_weather_cache",
  ndvi: "willay_ndvi_cache",
  alerts: "willay_alerts_cache",
  prefs: "willay_user_prefs",
  pendingAlerts: "willay_pending_alerts",
} as const;

function safeGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Check if cache is older than 24h
    if (parsed._cachedAt && Date.now() - parsed._cachedAt > 86400000) {
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

function safeSet(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, _cachedAt: Date.now() }));
  } catch {
    // storage full — silently ignore
  }
}

export const offlineCache = {
  getWeather: () => safeGet<any>(KEYS.weather),
  setWeather: (data: any) => safeSet(KEYS.weather, data),

  getNDVI: () => safeGet<any>(KEYS.ndvi),
  setNDVI: (data: any) => safeSet(KEYS.ndvi, data),

  getAlerts: () => safeGet<any[]>(KEYS.alerts),
  setAlerts: (data: any[]) => safeSet(KEYS.alerts, data),

  addPendingAlert: (alert: any) => {
    const existing = safeGet<any[]>(KEYS.pendingAlerts) || [];
    existing.push({ ...alert, _savedAt: Date.now() });
    safeSet(KEYS.pendingAlerts, existing);
  },
  getPendingAlerts: () => safeGet<any[]>(KEYS.pendingAlerts) || [],
  clearPendingAlerts: () => localStorage.removeItem(KEYS.pendingAlerts),
};
