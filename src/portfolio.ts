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

// Ubah posisi yang sudah ada: set qty & harga ke nilai pasti (bukan rata-rata).
// Untuk koreksi, beda dengan addHolding yang merata-ratakan pembelian baru.
export function editHolding(list: Holding[], sym: string, qty: number, price: number): Holding[] {
  return list.map((h) => (h.sym === sym ? { sym, qty, price } : h));
}

export function removeHolding(list: Holding[], sym: string): Holding[] {
  return list.filter((h) => h.sym !== sym);
}

// Parse portofolio dari isi file JSON atau CSV. Menerima:
//  - JSON: array [{sym, qty, price}] (format ekspor app ini), atau
//  - CSV : header dengan kolom kode/sym, lot/qty/lembar, harga/price
//          (mis. ekspor Stockbit). Baris tak valid dilewati.
// Kode ".JK" (IDX) dengan kolom "lot" dikali 100 → lembar. Mengembalikan
// daftar holdings tergabung (rata-rata tertimbang bila kode berulang/sudah ada).
export function parseHoldings(text: string): Holding[] {
  const t = text.trim();
  let rows: { sym: string; qty: number; price: number }[] = [];

  if (t.startsWith("[") || t.startsWith("{")) {
    const v = JSON.parse(t);
    const arr = Array.isArray(v) ? v : [v];
    rows = arr
      .map((h: Record<string, unknown>) => ({
        sym: String(h.sym ?? h.symbol ?? h.ticker ?? h.kode ?? "").trim().toUpperCase(),
        qty: Number(h.qty ?? h.shares ?? h.lembar ?? 0),
        price: Number(h.price ?? h.avg ?? h.harga ?? 0),
      }));
  } else {
    const lines = t.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
    const head = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
    const iSym = col("sym", "symbol", "ticker", "kode", "stock", "code");
    const iLot = col("lot", "lots");
    const iQty = col("qty", "quantity", "shares", "lembar", "volume", "amount");
    const iPrice = col("price", "harga", "avg", "avgprice", "average", "avg price", "harga beli", "buy price");
    if (iSym < 0 || iPrice < 0 || (iQty < 0 && iLot < 0)) return [];
    for (const line of lines.slice(1)) {
      const c = line.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
      const sym = (c[iSym] ?? "").toUpperCase();
      if (!sym) continue;
      // ponytail: treats "." as a decimal point, not a thousands separator, so a
      // locale-formatted "3.100" reads as 3.1. Plain numbers (3100) and US
      // decimals (150.25) parse correctly; add locale detection only if a broker
      // export with dotted thousands actually shows up.
      const num = (s: string) => Number((s ?? "").replace(/[^0-9.\-]/g, ""));
      // Pakai kolom lot bila ada & terisi (IDX: ×100 lembar), selain itu qty langsung.
      const lotVal = iLot >= 0 ? num(c[iLot]) : NaN;
      const qty = Number.isFinite(lotVal) && lotVal > 0 ? lotVal * 100 : num(c[iQty]);
      rows.push({ sym, qty, price: num(c[iPrice]) });
    }
  }

  // Gabung baris valid lewat addHolding (rata-rata tertimbang bila berulang).
  let out: Holding[] = [];
  for (const r of rows) {
    if (!r.sym || !Number.isFinite(r.qty) || r.qty <= 0 || !Number.isFinite(r.price) || r.price <= 0) continue;
    out = addHolding(out, r.sym, r.qty, r.price);
  }
  return out;
}
