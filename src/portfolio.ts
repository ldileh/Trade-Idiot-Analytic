// Portofolio pribadi: daftar saham yang dimiliki (kode, jumlah lembar, harga
// beli rata-rata). Disimpan di localStorage — sama seperti favorit, tidak
// butuh backend. Satu entri per kode saham; beli lagi = rata-rata tertimbang.
export interface Holding {
  sym: string; // kode saham, uppercase (mis. "BBCA.JK", "AAPL")
  qty: number; // jumlah lembar
  price: number; // harga beli rata-rata per lembar
}

const KEY = "portfolio";

export function loadHoldings(): Holding[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(v)) return [];
    return v.filter(
      (h): h is Holding =>
        typeof h?.sym === "string" && typeof h?.qty === "number" && typeof h?.price === "number" && h.qty > 0 && h.price > 0,
    );
  } catch {
    return [];
  }
}

export function saveHoldings(list: Holding[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// Tambah pembelian. Kalau kodenya sudah ada, gabung dengan rata-rata tertimbang.
export function addHolding(list: Holding[], sym: string, qty: number, price: number): Holding[] {
  const key = sym.trim().toUpperCase();
  const cur = list.find((h) => h.sym === key);
  if (!cur) return [...list, { sym: key, qty, price }];
  const totalQty = cur.qty + qty;
  const avg = (cur.qty * cur.price + qty * price) / totalQty;
  return list.map((h) => (h.sym === key ? { sym: key, qty: totalQty, price: avg } : h));
}

export function removeHolding(list: Holding[], sym: string): Holding[] {
  return list.filter((h) => h.sym !== sym);
}
