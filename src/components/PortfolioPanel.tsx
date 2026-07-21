// Panel portofolio: catat saham yang dimiliki (kode, jumlah lembar, harga
// beli). Klik sebuah posisi untuk membukanya di grafik — di sana muncul garis
// "harga beli kamu" plus hitungan untung/rugi di ringkasan harga.
import { useEffect, useRef, useState } from "react";
import { getMarketMap } from "../api/client";
import { currencyFor, isIDX, money, shares } from "../format";
import { suggest } from "../suggestions";
import { getNews, getPatterns } from "../api/client";
import { parseHoldings, type Holding } from "../portfolio";
import type { NewsResponse, PatternsResponse } from "../types";
import { STOCKS_BY_MARKET } from "../stocks";
import { InfoTip } from "./ui";

// Nama perusahaan dari daftar picker (US + IDX); kode custom tampil tanpa nama.
function nameOf(sym: string): string | undefined {
  return (
    STOCKS_BY_MARKET.id.find((s) => s.sym === sym) ?? STOCKS_BY_MARKET.us.find((s) => s.sym === sym)
  )?.name;
}

export default function PortfolioPanel({
  open,
  holdings,
  onAdd,
  onEdit,
  onRemove,
  onImport,
  onPick,
}: {
  open: boolean;
  holdings: Holding[];
  onAdd: (sym: string, qty: number, price: number) => void;
  onEdit: (sym: string, qty: number, price: number) => void;
  onRemove: (sym: string) => void;
  onImport: (imported: Holding[]) => void;
  onPick: (sym: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // izinkan pilih file yang sama lagi
    if (!file) return;
    try {
      const parsed = parseHoldings(await file.text());
      if (parsed.length === 0) {
        setImportMsg("Tidak ada baris valid. Butuh kolom kode, jumlah (lot/lembar), dan harga.");
        return;
      }
      onImport(parsed);
      setImportMsg(`${parsed.length} saham diimpor. ✅`);
    } catch {
      setImportMsg("Gagal membaca file. Pastikan format JSON atau CSV.");
    }
  }

  // Unduh portofolio saat ini sebagai JSON (bisa diimpor lagi).
  function exportJson() {
    const blob = new Blob([JSON.stringify(holdings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portofolio.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const [sym, setSym] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editPrice, setEditPrice] = useState("");
  // Satuan jumlah untuk saham IDX: "lot" (×100 lembar, seperti Stockbit) atau
  // "lembar". US selalu lembar (bisa pecahan). Default lot untuk .JK.
  const [unit, setUnit] = useState<"lot" | "lembar">("lot");
  const idxInput = isIDX(sym);
  // Harga terkini per kode (satu batch quote saat panel dibuka) → untuk untung/rugi.
  const [prices, setPrices] = useState<Record<string, number>>({});
  // Pola per kode (mesin /patterns) → dipakai untuk saran aksi (tahan/jual/tambah).
  const [patterns, setPatterns] = useState<Record<string, PatternsResponse>>({});
  // Berita terkini per kode → sentimen ikut menyetir saran + headline ditampilkan.
  const [news, setNews] = useState<Record<string, NewsResponse>>({});

  const syms = holdings.map((h) => h.sym).join(",");
  useEffect(() => {
    if (!open || holdings.length === 0) return;
    let cancelled = false;
    getMarketMap(holdings.map((h) => h.sym))
      .then((res) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const t of res.tiles) if (t.price != null) map[t.sym] = t.price;
        setPrices(map);
      })
      .catch(() => !cancelled && setPrices({}));
    // Analisa pola tiap kepemilikan (paralel; yang gagal dilewati, bukan semua).
    Promise.allSettled(holdings.map((h) => getPatterns(h.sym))).then((results) => {
      if (cancelled) return;
      const map: Record<string, PatternsResponse> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled") map[holdings[i].sym] = r.value;
      });
      setPatterns(map);
    });
    // Berita terkini per kode (paralel, best-effort).
    Promise.allSettled(holdings.map((h) => getNews(h.sym))).then((results) => {
      if (cancelled) return;
      const map: Record<string, NewsResponse> = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled") map[holdings[i].sym] = r.value;
      });
      setNews(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, syms]);

  // Total untung/rugi dikelompokkan per mata uang (US $ dan IDX Rp tak bisa dijumlah).
  const totals = new Map<string, { cost: number; value: number; sample: string }>();
  for (const h of holdings) {
    const last = prices[h.sym];
    if (last == null) continue;
    const cur = currencyFor(h.sym);
    const t = totals.get(cur) ?? { cost: 0, value: 0, sample: h.sym };
    t.cost += h.qty * h.price;
    t.value += h.qty * last;
    totals.set(cur, t);
  }

  function startEdit(h: Holding) {
    setEditing(h.sym);
    setEditQty(String(h.qty));
    setEditPrice(String(h.price));
  }

  function saveEdit() {
    const q = Number(editQty);
    const p = Number(editPrice);
    if (!editing || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) return;
    onEdit(editing, q, p);
    setEditing(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(qty);
    const p = Number(price);
    if (!sym.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) return;
    // IDX dalam satuan lot → simpan sebagai lembar (1 lot = 100 lembar).
    const lembar = idxInput && unit === "lot" ? q * 100 : q;
    onAdd(sym, lembar, p);
    setSym("");
    setQty("");
    setPrice("");
  }

  return (
    <div>
      <form className="row" onSubmit={submit} style={{ marginBottom: 16 }}>
        <label className="field" style={{ flex: "1 1 130px" }}>
          <span>
            Kode saham <InfoTip text="Kode saham yang kamu beli, mis. BBCA.JK (Indonesia, akhiran .JK) atau AAPL (Amerika)." />
          </span>
          <input
            type="text"
            value={sym}
            onChange={(e) => setSym(e.target.value)}
            placeholder="mis. BBCA.JK"
            style={{ textTransform: "uppercase" }}
            aria-label="Kode saham"
          />
        </label>
        <label className="field" style={{ flex: "1 1 110px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {idxInput && unit === "lot" ? "Jumlah lot" : "Jumlah lembar"}{" "}
            <InfoTip text="Berapa banyak saham yang kamu miliki. Saham Indonesia: 1 lot = 100 lembar (Stockbit menampilkan lot). Saham US: isi lembar, boleh pecahan." />
            {idxInput && (
              <span className="unit-toggle">
                <button type="button" className={unit === "lot" ? "active" : ""} onClick={() => setUnit("lot")}>lot</button>
                <button type="button" className={unit === "lembar" ? "active" : ""} onClick={() => setUnit("lembar")}>lembar</button>
              </span>
            )}
          </span>
          <input
            type="number"
            min="0"
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={idxInput && unit === "lot" ? "mis. 574 (lot)" : "mis. 100"}
            aria-label={idxInput && unit === "lot" ? "Jumlah lot" : "Jumlah lembar"}
          />
        </label>
        <label className="field" style={{ flex: "1 1 130px" }}>
          <span>
            Harga beli / lembar <InfoTip text="Harga rata-rata saat kamu beli, per lembar. Kalau beli beberapa kali, tambahkan lagi — app menghitung rata-ratanya otomatis." />
          </span>
          <input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="mis. 9500" aria-label="Harga beli per lembar" />
        </label>
        <button type="submit" className="btn-primary" style={{ flex: "0 0 auto", height: 42 }}>
          + Tambah
        </button>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input ref={fileRef} type="file" accept=".json,.csv,text/csv,application/json" onChange={onFile} style={{ display: "none" }} />
        <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
          📥 Impor (CSV / JSON)
        </button>
        {holdings.length > 0 && (
          <button type="button" className="btn-ghost btn-sm" onClick={exportJson}>
            📤 Ekspor JSON
          </button>
        )}
        <InfoTip text="Impor dari file JSON (hasil ekspor app ini) atau CSV dengan kolom kode, jumlah (lot/lembar), dan harga — mis. ekspor dari Stockbit. Kode .JK dengan kolom 'lot' otomatis dikali 100 lembar. Data digabung ke portofolio yang ada." />
        {importMsg && <span className="muted" style={{ fontSize: 12 }}>{importMsg}</span>}
      </div>

      {holdings.length === 0 ? (
        <p className="muted">Belum ada saham di portofolio. Isi formulir di atas untuk mencatat saham pertamamu. 📝</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {holdings.map((h) => {
            if (editing === h.sym) {
              return (
                <div key={h.sym} className="mini" style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
                  <div className="v" style={{ marginTop: 0, flexBasis: "100%" }}>{h.sym}</div>
                  <label className="field" style={{ flex: "1 1 100px" }}>
                    <span>Jumlah lembar</span>
                    <input type="number" min="1" step="any" value={editQty} onChange={(e) => setEditQty(e.target.value)} aria-label={`Jumlah lembar ${h.sym}`} />
                  </label>
                  <label className="field" style={{ flex: "1 1 120px" }}>
                    <span>Harga beli / lembar</span>
                    <input type="number" min="0" step="any" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} aria-label={`Harga beli ${h.sym}`} />
                  </label>
                  <button type="button" className="btn-primary" style={{ flex: "0 0 auto", height: 42 }} onClick={saveEdit}>
                    Simpan
                  </button>
                  <button type="button" className="btn-ghost" style={{ flex: "0 0 auto", height: 42 }} onClick={() => setEditing(null)}>
                    Batal
                  </button>
                </div>
              );
            }
            const last = prices[h.sym];
            const cost = h.qty * h.price;
            const value = last != null ? h.qty * last : null;
            const diff = value != null ? value - cost : null;
            const pct = diff != null && cost !== 0 ? (diff / cost) * 100 : null;
            const up = (diff ?? 0) >= 0;
            const pat = patterns[h.sym];
            const nw = news[h.sym];
            const sg = pat ? suggest(pat, pct, nw?.sentiment ?? 0) : null;
            const headline = nw?.items[0];
            return (
              <div
                key={h.sym}
                className="mini"
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                onClick={() => onPick(h.sym)}
                title={`Buka ${h.sym} di grafik`}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="v" style={{ marginTop: 0 }}>
                    {h.sym}
                    {nameOf(h.sym) && (
                      <span className="muted" style={{ fontWeight: 500, fontSize: 12, marginLeft: 8 }}>{nameOf(h.sym)}</span>
                    )}
                  </div>
                  <div className="k">
                    {shares(h.qty, h.sym)} lembar @ {money(h.price, h.sym)} · modal {money(cost, h.sym)}
                  </div>
                  <div className="k" style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {value != null ? (
                      <>
                        <span>nilai kini {money(value, h.sym)}</span>
                        <span className={`pill ${up ? "up" : "down"}`} style={{ fontSize: 12 }}>
                          {up ? "▲" : "▼"} {money(Math.abs(diff!), h.sym)} ({up ? "+" : "−"}{Math.abs(pct!).toFixed(2)}%)
                        </span>
                      </>
                    ) : (
                      <span className="muted">memuat harga…</span>
                    )}
                  </div>
                  {sg && (
                    <div className="k" style={{ marginTop: 4, display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      <span className={`pill sg-${sg.action}`} style={{ fontSize: 12, fontWeight: 700 }}>{sg.label}</span>
                      <span className="muted" style={{ fontSize: 11.5 }}>{sg.why}</span>
                    </div>
                  )}
                  {headline && (
                    <div className="k" style={{ marginTop: 3, fontSize: 11.5 }}>
                      <span title="Sentimen berita">{headline.sentiment > 0 ? "📈" : headline.sentiment < 0 ? "📉" : "📰"}</span>{" "}
                      {headline.url ? (
                        <a href={headline.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--accent)" }}>
                          {headline.title}
                        </a>
                      ) : (
                        <span className="muted">{headline.title}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="modal-x"
                  aria-label={`Ubah ${h.sym}`}
                  title="Ubah posisi"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(h);
                  }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="modal-x"
                  aria-label={`Hapus ${h.sym} dari portofolio`}
                  title="Hapus dari portofolio"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(h.sym);
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}

          {totals.size > 0 && (
            <div className="mini" style={{ marginTop: 4 }}>
              <div className="k">Total untung/rugi (per mata uang):</div>
              {[...totals.entries()].map(([cur, t]) => {
                const diff = t.value - t.cost;
                const pct = t.cost !== 0 ? (diff / t.cost) * 100 : 0;
                const up = diff >= 0;
                return (
                  <div key={cur} className="v" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {money(t.value, t.sample)}
                    <span className="muted" style={{ fontWeight: 500, fontSize: 12 }}>dari modal {money(t.cost, t.sample)}</span>
                    <span className={`pill ${up ? "up" : "down"}`} style={{ fontSize: 12.5 }}>
                      {up ? "▲ untung" : "▼ rugi"} {money(Math.abs(diff), t.sample)} ({up ? "+" : "−"}{Math.abs(pct).toFixed(2)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
            Klik sebuah posisi untuk membukanya di grafik — garis 📌 harga beli & untung/rugi langsung muncul.
            <br />
            Saran aksi (Tahan/Kurangi/Jual/Tambah) dihitung dari pola harga + untung-rugimu + sentimen berita terkini — bahan bantu berpikir, <b>BUKAN ajakan jual/beli</b>.
          </p>
        </div>
      )}
    </div>
  );
}

// Ringkasan posisi untuk saham yang sedang tampil di grafik: modal vs nilai
// sekarang, plus untung/rugi. Dipakai di panel kiri, di bawah ringkasan harga.
export function PositionSummary({ holding, last }: { holding: Holding; last: number }) {
  const cost = holding.qty * holding.price;
  const value = holding.qty * last;
  const diff = value - cost;
  const pct = cost !== 0 ? (diff / cost) * 100 : 0;
  const up = diff >= 0;
  return (
    <div className="mini" style={{ marginTop: 10 }}>
      <div className="k">
        💼 Posisimu: {shares(holding.qty, holding.sym)} lembar @ {money(holding.price, holding.sym)}
      </div>
      <div className="v" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {money(value, holding.sym)}
        <span className={`pill ${up ? "up" : "down"}`} style={{ fontSize: 12.5 }}>
          {up ? "▲ untung" : "▼ rugi"} {money(Math.abs(diff), holding.sym)} ({up ? "+" : "−"}
          {Math.abs(pct).toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}
