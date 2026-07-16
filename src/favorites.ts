// Favorit per-pasar (US/IDX), tersimpan di localStorage. Dipakai TickerInput
// (bintang) dan Peta Pasar. Satu sumber agar formatnya tidak menyimpang.
import type { Market } from "./stocks";

export const FAV_KEY = "favStocks";

export function loadFavorites(): Record<Market, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
    return { us: Array.isArray(v.us) ? v.us : [], id: Array.isArray(v.id) ? v.id : [] };
  } catch {
    return { us: [], id: [] };
  }
}
