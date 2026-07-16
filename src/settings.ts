// Pengaturan "Sumber Data" (BYOK). Disimpan di localStorage — sama seperti
// portfolio/favorites, tidak butuh backend. User memilih sumber per fitur
// (harga/fundamental/kepemilikan): Default (gratis, tertunda) atau Custom
// dengan API key sendiri, plus toggle Hemat Data vs Real-time.
//
// Key hanya tersimpan lokal di mesin user; frontend meneruskannya ke backend
// lewat header per request (lihat api/client.ts). Tanpa pengaturan apa pun,
// perilaku app identik dengan default.
export type Feature = "prices" | "fundamentals" | "ownership";
export type Mode = "hemat" | "realtime";

// Nama provider yang bisa dipilih per fitur. "default" = jalur gratis bawaan
// (Yahoo/KSEI). Provider eksternal (finnhub/fmp/sectors/twelvedata) aktif hanya
// bila user mengisi key-nya (task 018 menambah adapter-nya di backend).
export interface Settings {
  mode: Mode;
  providers: Record<Feature, string>; // feature -> provider name
  keys: Record<string, string>; // provider name -> API key
}

const KEY = "data_settings";

export const DEFAULT_SETTINGS: Settings = {
  mode: "hemat",
  providers: { prices: "default", fundamentals: "default", ownership: "default" },
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
export function settingsHeaders(s: Settings): Record<string, string> {
  const h: Record<string, string> = {};
  if (s.mode === "realtime") h["X-Realtime"] = "1";
  for (const [feat, prov] of Object.entries(s.providers)) {
    if (prov && prov !== "default") h[`X-Provider-${feat}`] = prov;
  }
  for (const [prov, key] of Object.entries(s.keys)) {
    if (key.trim()) h[`X-Key-${prov}`] = key.trim();
  }
  return h;
}
