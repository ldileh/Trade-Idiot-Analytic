// Pengaturan "Sumber Data" (BYOK). Disimpan di localStorage — sama seperti
// portfolio/favorites, tidak butuh backend. User memilih sumber per fitur
// (harga/fundamental/kepemilikan): Default (gratis, tertunda) atau Custom
// dengan API key sendiri, plus toggle Hemat Data vs Real-time.
//
// Key hanya tersimpan lokal di mesin user; frontend meneruskannya ke backend
// lewat header per request (lihat api/client.ts). Tanpa pengaturan apa pun,
// perilaku app identik dengan default.
export type Mode = "hemat" | "realtime";

// Fundamental dipilih terpisah per pasar (US & IDX) karena sumbernya berbeda —
// user bisa punya key FMP untuk saham US sekaligus Sectors.app untuk saham IDX,
// dan keduanya dipakai sesuai kode saham yang sedang dibuka.
export interface Settings {
  mode: Mode;
  providers: {
    prices: string;
    fundamentals_us: string;
    fundamentals_id: string;
    ownership: string;
  };
  keys: Record<string, string>; // provider name -> API key
}

// Fitur yang punya pilihan provider (untuk membangun header per request).
export type Feature = keyof Settings["providers"];

const KEY = "data_settings";

export const DEFAULT_SETTINGS: Settings = {
  mode: "hemat",
  providers: { prices: "default", fundamentals_us: "default", fundamentals_id: "default", ownership: "default" },
  keys: {},
};

export function loadSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!v || typeof v !== "object") return { ...DEFAULT_SETTINGS };
    return {
      mode: v.mode === "realtime" ? "realtime" : "hemat",
      providers: { ...DEFAULT_SETTINGS.providers, ...(v.providers || {}) },
      keys: typeof v.keys === "object" && v.keys ? v.keys : {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

// Headers that carry the user's choices to the backend for one request.
// Empty when everything is default, so a plain request behaves exactly as before.
// Fundamentals is market-specific (fundamentals_us / fundamentals_id) and can't
// be resolved without a ticker, so it's handled per-request in api/client.ts
// (fundamentalsHeader) and skipped here.
export function settingsHeaders(s: Settings): Record<string, string> {
  const h: Record<string, string> = {};
  if (s.mode === "realtime") h["X-Realtime"] = "1";
  if (s.providers.prices !== "default") h["X-Provider-prices"] = s.providers.prices;
  if (s.providers.ownership !== "default") h["X-Provider-ownership"] = s.providers.ownership;
  for (const [prov, key] of Object.entries(s.keys)) {
    if (key.trim()) h[`X-Key-${prov}`] = key.trim();
  }
  return h;
}

// The fundamentals provider header for a specific ticker, picking the US or IDX
// choice by the ticker's market. Empty when that market is on Default.
export function fundamentalsHeader(s: Settings, ticker: string): Record<string, string> {
  const isID = ticker.trim().toUpperCase().endsWith(".JK");
  const prov = isID ? s.providers.fundamentals_id : s.providers.fundamentals_us;
  return prov && prov !== "default" ? { "X-Provider-fundamentals": prov } : {};
}
