// Panel portofolio: catat saham yang dimiliki (kode, jumlah lembar, harga
// beli). Klik sebuah posisi untuk membukanya di grafik — di sana muncul garis
// "harga beli kamu" plus hitungan untung/rugi di ringkasan harga.
import { useEffect, useState } from "react";
import { getMarketMap } from "../api/client";
import { currencyFor, money } from "../format";
import type { Holding } from "../portfolio";
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
  onRemove,
  onPick,
}: {
  open: boolean;
  holdings: Holding[];
  onAdd: (sym: string, qty: number, price: number) => void;
  onRemove: (sym: string) => void;
  onPick: (sym: string) => void;
}) {
  const [sym, setSym] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  // Harga terkini per kode (satu batch quote saat panel dibuka) → untuk untung/rugi.
  const [prices, setPrices] = useState<Record<string, number>>({});

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(qty);
    const p = Number(price);
    if (!sym.trim() || !Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0) return;
    onAdd(sym, q, p);
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
          <span>
            Jumlah lembar <InfoTip text="Berapa lembar saham yang kamu miliki. Untuk saham Indonesia: 1 lot = 100 lembar." />
          </span>
          <input type="number" min="1" step="any" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="mis. 100" aria-label="Jumlah lembar" />
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

      {holdings.length === 0 ? (
        <p className="muted">Belum ada saham di portofolio. Isi formulir di atas untuk mencatat saham pertamamu. 📝</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {holdings.map((h) => {
            const last = prices[h.sym];
            const cost = h.qty * h.price;
            const value = last != null ? h.qty * last : null;
            const diff = value != null ? value - cost : null;
            const pct = diff != null && cost !== 0 ? (diff / cost) * 100 : null;
            const up = (diff ?? 0) >= 0;
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
                    {h.qty.toLocaleString("id-ID")} lembar @ {money(h.price, h.sym)} · modal {money(cost, h.sym)}
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
                </div>
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
        💼 Posisimu: {holding.qty.toLocaleString("id-ID")} lembar @ {money(holding.price, holding.sym)}
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
