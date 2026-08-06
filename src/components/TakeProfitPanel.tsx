// Panel "Target Take Profit": di harga berapa sebaiknya untung diamankan.
// Empat metode dengan dasar riset masing-masing (ATR/Wilder, R-multiple/Tharp,
// resistance/George & Hwang, trailing/Chandelier), ditampilkan sebagai peta
// harga visual + kartu penjelasan. Semua angka datang dari backend /takeprofit.
import { useEffect, useState } from "react";
import { getTakeProfit, screenTakeProfit } from "../api/client";
import { isIDX, money, shares } from "../format";
import { splitQty, type Holding } from "../portfolio";
import type {
  TakeProfitCandidate,
  TakeProfitMethod,
  TakeProfitResponse,
  TakeProfitTarget,
} from "../types";
import { InfoTip } from "./ui";

const METHOD_EMOJI: Record<string, string> = {
  atr: "📏",
  rr: "⚖️",
  resistance: "🧱",
  trailing: "🪝",
  stop: "🛑",
};

const TREND_EMOJI: Record<string, string> = {
  uptrend: "🟢",
  downtrend: "🔴",
  sideways_up: "🟡",
  sideways_down: "🟠",
  unknown: "⚪",
};

const VOL_EMOJI: Record<string, string> = { calm: "🟢", normal: "🟡", wild: "🔴", unknown: "⚪" };

const TIP =
  "Menentukan titik jual SEBELUM harga bergerak adalah inti manajemen risiko: saat harga sudah " +
  "melonjak (atau jatuh), keputusan hampir selalu dikendalikan emosi. Empat metode di bawah " +
  "menjawab pertanyaan berbeda — pilih yang paling cocok dengan gaya kamu, jangan dipakai semua sekaligus.";

// Peta harga: memvisualkan seluruh target pada satu sumbu vertikal, supaya
// terlihat mana yang dekat dan mana yang jauh — angka saja sulit dibandingkan.
// Skala dinormalkan dari level terendah (trailing stop) ke target tertinggi.
function PriceMap({ data, sym }: { data: TakeProfitResponse; sym: string }) {
  const points: { price: number; label: string; tone: "target" | "now" | "entry" | "stop" }[] = [];

  for (const m of data.methods) {
    if (!m.enough_data) continue;
    for (const t of m.targets) {
      // Hanya target yang disorot agar peta tidak penuh garis yang saling tumpuk.
      if (t.emphasis) points.push({ price: t.price, label: `${METHOD_EMOJI[m.key]} ${t.label}`, tone: "target" });
    }
  }
  points.push({ price: data.price, label: "Harga sekarang", tone: "now" });
  if (data.has_position && !data.underwater && data.entry !== data.price) {
    points.push({ price: data.entry, label: "Harga belimu", tone: "entry" });
  }
  if (data.trailing.enough_data && data.trailing.price != null && !data.trailing.triggered) {
    points.push({ price: data.trailing.price, label: "🪝 Trailing stop", tone: "stop" });
  }

  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  if (!(hi > lo)) return null;

  // Posisi 0–100% dari bawah; diurutkan menurun agar yang tertinggi di atas.
  const sorted = [...points].sort((a, b) => b.price - a.price);

  return (
    <div className="tp-map">
      {sorted.map((p, i) => {
        const pct = ((p.price - lo) / (hi - lo)) * 100;
        const diff = ((p.price / data.price - 1) * 100).toFixed(1);
        return (
          <div key={`${p.label}-${i}`} className={`tp-map-row tone-${p.tone}`}>
            <div className="tp-map-label">{p.label}</div>
            <div className="tp-map-track">
              <div className="tp-map-dot" style={{ left: `${pct}%` }} />
            </div>
            <div className="tp-map-price">
              {money(p.price, sym)}
              {p.tone !== "now" && (
                <span className="tp-map-diff">
                  {Number(diff) >= 0 ? "+" : ""}
                  {diff}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// "6 lot (600 lembar)" untuk IDX, "12 lembar" untuk sisanya.
function qtyText(qty: number, sym: string): string {
  return isIDX(sym) ? `${shares(qty / 100, sym)} lot (${shares(qty, sym)} lembar)` : `${shares(qty, sym)} lembar`;
}

function TargetRow({ t, sym, showEntry }: { t: TakeProfitTarget; sym: string; showEntry: boolean }) {
  return (
    <div className={`tp-target${t.emphasis ? " main" : ""}`}>
      <div className="tp-target-head">
        <span className="tp-target-label">
          {t.label}
          {t.emphasis && <span className="tp-badge">utama</span>}
        </span>
        <span className="tp-target-price">{money(t.price, sym)}</span>
      </div>
      <div className="tp-target-meta">
        <span className={Number(t.pct_from_now) >= 0 ? "up" : "down"}>
          {t.pct_from_now >= 0 ? "+" : ""}
          {t.pct_from_now}% dari harga sekarang
        </span>
        {showEntry && t.pct_from_entry != null && (
          <span className="muted">
            · {t.pct_from_entry >= 0 ? "+" : ""}
            {t.pct_from_entry}% dari harga belimu
          </span>
        )}
      </div>
      {t.note && <div className="p-sum" style={{ marginTop: 4 }}>{t.note}</div>}
    </div>
  );
}

function MethodCard({
  m,
  sym,
  showEntry,
  picked = false,
}: {
  m: TakeProfitMethod;
  sym: string;
  showEntry: boolean;
  picked?: boolean;
}) {
  return (
    <div className={`tp-method${m.enough_data ? "" : " empty"}${picked ? " picked" : ""}`}>
      <div className="p-head" style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 13.5 }}>
          {METHOD_EMOJI[m.key]} {m.label}
          {picked && <span className="tp-badge">cocok</span>}
        </span>
      </div>
      <div className="p-sum">{m.summary}</div>

      {m.enough_data && (
        <>
          <div className="tp-targets">
            {m.targets.map((t) => (
              <TargetRow key={t.label} t={t} sym={sym} showEntry={showEntry} />
            ))}
          </div>
          <details className="tp-why">
            <summary>Kenapa metode ini?</summary>
            <div className="p-sum" style={{ marginTop: 6 }}>{m.why}</div>
            <div className="tp-ref">📚 {m.reference}</div>
          </details>
        </>
      )}
    </div>
  );
}

// Diagnosa kondisi emiten + metode yang paling cocok untuk kondisi itu. Ini
// yang menjawab "dari empat metode tadi, saya pakai yang mana?".
function ConditionCard({ data }: { data: TakeProfitResponse }) {
  const c = data.condition;
  return (
    <div className="tp-pick">
      <div className="tp-pick-head">
        <span className="tp-pick-kicker">Paling cocok untuk kondisi {data.ticker} sekarang</span>
        <div className="tp-pick-title">
          {METHOD_EMOJI[c.recommended] ?? "🎯"} {c.recommended_label}
        </div>
      </div>

      <div className="tp-cond">
        <span className="tp-cond-chip">
          {TREND_EMOJI[c.trend]} {c.trend_text}
        </span>
        <span className="tp-cond-chip">
          {VOL_EMOJI[c.vol]} {c.vol_text}
        </span>
        {c.at_new_high ? (
          <span className="tp-cond-chip">🚀 Harga di tertinggi baru — tidak ada resistance di atasnya.</span>
        ) : (
          c.near_high && <span className="tp-cond-chip">🎯 Dekat puncak 52 minggu.</span>
        )}
      </div>

      <div className="p-sum" style={{ marginTop: 8 }}>{c.recommended_why}</div>
      <div className="tp-ref">📚 {c.recommended_reference}</div>
    </div>
  );
}

// Saran batas rugi. Ditempatkan sejajar dengan target karena keduanya satu
// paket: target tanpa stop bukan rencana, hanya harapan.
function StopCard({ data, sym }: { data: TakeProfitResponse; sym: string }) {
  const s = data.stop_advice;
  if (!s.enough_data) return <div className="tp-method empty"><div className="p-sum">{s.summary}</div></div>;
  return (
    <div className="tp-method tp-stop">
      <div className="p-head" style={{ marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 13.5 }}>🛑 Batas Rugi (Stop Loss)</span>
        <InfoTip text="Menentukan batas rugi lebih dulu adalah satu-satunya bagian dari hasil trading yang benar-benar kamu kendalikan. Lebar stop di sini menyesuaikan volatilitas saham ini, bukan angka bulat seragam." />
      </div>
      <div className="tp-target main tp-stop-target">
        <div className="tp-target-head">
          <span className="tp-target-label">{s.method}</span>
          <span className="tp-target-price">{money(s.price!, sym)}</span>
        </div>
        <div className="tp-target-meta">
          <span className="down">{s.pct_from_now}% dari harga sekarang</span>
          {s.pct_from_entry != null && (
            <span className="muted">
              {" "}
              · {s.pct_from_entry >= 0 ? "+" : ""}
              {s.pct_from_entry}% dari harga belimu
            </span>
          )}
        </div>
      </div>
      <div className="p-sum" style={{ marginTop: 6 }}>{s.summary}</div>
      <div className="tp-risk">⚠️ {s.risk_note}</div>
      <details className="tp-why">
        <summary>Kenapa selebar ini?</summary>
        <div className="p-sum" style={{ marginTop: 6 }}>{s.why}</div>
        <div className="tp-ref">📚 {s.reference}</div>
      </details>
    </div>
  );
}

// Peringkat portofolio: emiten mana yang paling perlu diamankan untungnya.
function ScreenList({ holdings }: { holdings: Holding[] }) {
  const [rows, setRows] = useState<TakeProfitCandidate[] | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = holdings.map((h) => `${h.sym}:${h.price}`).join(",");
  useEffect(() => {
    if (holdings.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    screenTakeProfit(holdings.map((h) => ({ sym: h.sym, price: h.price })))
      .then((res) => {
        if (cancelled) return;
        setRows(res.candidates);
        setSkipped(res.skipped);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (holdings.length === 0) {
    return (
      <p className="muted">
        Portofolio masih kosong. Catat saham yang kamu miliki di panel 💼 Portofolio, lalu kembali ke
        sini untuk melihat mana yang perlu diamankan untungnya.
      </p>
    );
  }
  if (loading && !rows) return <p className="muted">Menganalisa {holdings.length} saham…</p>;
  if (error) return <p className="muted">Gagal menganalisa: {error}</p>;
  if (!rows) return null;

  return (
    <div>
      <p className="p-sum" style={{ marginTop: 0 }}>
        Diurutkan dari yang paling perlu ditinjau. Penilaian menggabungkan besar untung, apakah tren
        berbalik, apakah trailing stop sudah terlewati, dan apakah target utama sudah tercapai —
        posisi yang <b>masih tren naik di dekat puncak justru diturunkan urgensinya</b>, karena riset
        George &amp; Hwang (2004) mendukung menahannya.
      </p>

      <div className="tp-screen">
        {rows.map((c) => (
          <div key={c.sym} className={`tp-cand u-${c.urgency}`}>
            <div className="tp-cand-head">
              <span className="tp-cand-sym">{c.sym}</span>
              <span className="tp-cand-label">{c.label}</span>
            </div>
            <div className="tp-cand-meta">
              <span>harga {money(c.price, c.sym)}</span>
              {c.pnl_pct != null && (
                <span className={c.pnl_pct >= 0 ? "up" : "down"}>
                  {" "}
                  · {c.pnl_pct >= 0 ? "▲ untung" : "▼ rugi"} {Math.abs(c.pnl_pct).toFixed(2)}%
                </span>
              )}
              {c.target != null && <span className="muted"> · target {money(c.target, c.sym)}</span>}
              {c.stop != null && <span className="muted"> · stop {money(c.stop, c.sym)}</span>}
            </div>
            {c.reasons.length > 0 && (
              <ul className="tp-cand-reasons">
                {c.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <div className="p-sum" style={{ marginTop: 4 }}>
              Metode yang cocok: <b>{c.recommended_label}</b>
            </div>
          </div>
        ))}
      </div>

      {skipped.length > 0 && (
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Tidak bisa dianalisa (data harga tidak tersedia): {skipped.join(", ")}.
        </p>
      )}
    </div>
  );
}

export default function TakeProfitPanel({
  open,
  ticker,
  buyPrice,
  holdings,
  onOpenReferences,
}: {
  open: boolean;
  ticker: string;
  // Harga beli rata-rata dari portofolio; null = saham ini tidak dimiliki.
  buyPrice: number | null;
  holdings: Holding[];
  // Buka modal "Dasar Ilmiah" — panel ini banyak mengutip riset, jadi sumber
  // lengkapnya harus terjangkau tanpa menutup panel dulu.
  onOpenReferences?: () => void;
}) {
  // Dua sudut pandang: satu emiten yang sedang dibuka, atau seluruh portofolio.
  const [tab, setTab] = useState<"one" | "all">("one");
  const [data, setData] = useState<TakeProfitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Batas rugi milik user — mengubah hitungan R-multiple dari stop default 1×ATR
  // ke risiko yang benar-benar dia ambil. Kosong = pakai default.
  const [stop, setStop] = useState("");
  const [appliedStop, setAppliedStop] = useState<number | null>(null);

  useEffect(() => {
    if (!open || tab !== "one" || !ticker.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTakeProfit(ticker, buyPrice, appliedStop)
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, tab, ticker, buyPrice, appliedStop]);

  if (!open) return null;

  // Pemilih sudut pandang, selalu tampil agar user bisa pindah walau satu sisi
  // sedang memuat atau gagal.
  const tabs = (
    <div className="tp-tabs">
      <button type="button" className={tab === "one" ? "active" : ""} onClick={() => setTab("one")}>
        🎯 Emiten ini
      </button>
      <button type="button" className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
        📋 Portofolio {holdings.length > 0 && <span className="count">{holdings.length}</span>}
      </button>
    </div>
  );

  if (tab === "all") {
    return (
      <div>
        <div className="p-head" style={{ marginBottom: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>📋 Siapa yang perlu take profit?</span>
          <InfoTip text="Menilai semua saham di portofolio sekaligus, lalu mengurutkannya dari yang paling perlu ditinjau. Bahan bantu berpikir, BUKAN ajakan jual." />
        </div>
        {tabs}
        <ScreenList holdings={holdings} />
      </div>
    );
  }

  if (loading && !data) return <div>{tabs}<p className="muted">Menghitung target…</p></div>;
  if (error) return <div>{tabs}<p className="muted">Gagal memuat target: {error}</p></div>;
  if (!data) return <div>{tabs}</div>;

  const sym = data.ticker;
  // % "dari harga belimu" hanya ditampilkan saat basisnya memang harga beli;
  // pada posisi rugi/untung besar basisnya sudah dipindah ke harga sekarang.
  const showEntry = data.has_position;
  const tr = data.trailing;
  // Kepemilikan nyata → rencana bertahap bisa disebut dalam lot, bukan "1/3".
  const held = holdings.find((h) => h.sym === sym);
  const split = held ? splitQty(held.qty, sym) : null;

  return (
    <div>
      <div className="p-head" style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 14 }}>🎯 Target Take Profit — {sym}</span>
        <InfoTip text={TIP} />
      </div>
      {tabs}

      <div className={`tp-headline${data.underwater ? " warn" : ""}`}>{data.headline}</div>

      <ConditionCard data={data} />

      {data.atr != null && (
        <div className="p-sum" style={{ marginTop: 6 }}>
          Harga sekarang {money(data.price, sym)} · pergerakan wajar harian (ATR-14){" "}
          {money(data.atr, sym)} ({data.atr_pct}%)
          {data.stop != null && <> · batas rugi dipakai {money(data.stop, sym)}</>}
        </div>
      )}

      <PriceMap data={data} sym={sym} />

      {/* Stop milik user: mengubah 1R jadi risiko sebenarnya, bukan asumsi 1×ATR. */}
      <form
        className="row"
        style={{ marginTop: 12, alignItems: "flex-end" }}
        onSubmit={(e) => {
          e.preventDefault();
          const v = Number(stop);
          setAppliedStop(Number.isFinite(v) && v > 0 ? v : null);
        }}
      >
        <label className="field" style={{ flex: "1 1 150px" }}>
          <span>
            Batas rugi (stop) kamu{" "}
            <InfoTip text="Harga di mana kamu akan keluar kalau salah. Mengisinya membuat target 'R' dihitung dari risiko sebenarnya yang kamu ambil, bukan asumsi 1× ATR. Kosongkan untuk memakai default." />
          </span>
          <input
            type="number"
            min="0"
            step="any"
            value={stop}
            onChange={(e) => setStop(e.target.value)}
            placeholder={data.stop != null ? `default ${data.stop}` : "mis. 8800"}
            aria-label="Batas rugi (stop loss)"
          />
        </label>
        <button type="submit" className="btn-ghost" style={{ flex: "0 0 auto", height: 42 }}>
          Hitung ulang
        </button>
      </form>

      <StopCard data={data} sym={sym} />

      <div className="tp-methods">
        {data.methods.map((m) => (
          <MethodCard
            key={m.key}
            m={m}
            sym={sym}
            showEntry={showEntry}
            picked={data.condition.recommended === m.key}
          />
        ))}

        {/* Trailing stop berdiri terpisah: ini bukan target tetap, tapi batas
            yang ikut naik — beda peran dari tiga metode di atasnya. */}
        <div
          className={`tp-method tp-trailing${tr.triggered ? " triggered" : ""}${
            data.condition.recommended === "trailing" ? " picked" : ""
          }`}
        >
          <div className="p-head" style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 800, fontSize: 13.5 }}>
              🪝 {tr.label}
              {data.condition.recommended === "trailing" && <span className="tp-badge">cocok</span>}
            </span>
          </div>
          <div className="p-sum">{tr.summary}</div>
          {tr.enough_data && tr.price != null && !tr.triggered && (
            <div className="tp-target main" style={{ marginTop: 8 }}>
              <div className="tp-target-head">
                <span className="tp-target-label">Jual bila turun ke</span>
                <span className="tp-target-price">{money(tr.price, sym)}</span>
              </div>
              <div className="tp-target-meta">
                <span className="down">{tr.pct_from_now}% dari harga sekarang</span>
                {tr.highest_high != null && (
                  <span className="muted"> · puncak 22 hari {money(tr.highest_high, sym)}</span>
                )}
              </div>
            </div>
          )}
          {tr.enough_data && (
            <details className="tp-why">
              <summary>Kenapa metode ini?</summary>
              <div className="p-sum" style={{ marginTop: 6 }}>{tr.why}</div>
              <div className="tp-ref">📚 {tr.reference}</div>
            </details>
          )}
        </div>
      </div>

      {data.plan.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="p-head" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13.5 }}>🧩 Rencana Jual Bertahap</span>
            <InfoTip text="Menjual sekaligus memaksa kamu benar dalam satu tebakan. Dibagi tiga: sebagian diamankan awal, sebagian di target utama, sisanya dibiarkan berjalan dengan trailing stop. Pembagian 1/3 ini konvensi manajemen posisi, bukan hasil satu riset tunggal." />
          </div>
          {split == null && (
            <p className="p-sum" style={{ margin: "0 0 8px" }}>
              {held
                ? `Kepemilikanmu (${qtyText(held.qty, sym)}) terlalu kecil untuk dibagi tiga — pakai satu target saja.`
                : "Catat jumlah kepemilikanmu di 💼 Portofolio, dan rencana ini otomatis berubah jadi jumlah lot yang konkret."}
            </p>
          )}
          <ol className="tp-plan">
            {data.plan.map((s, i) => {
              const part = split?.[i] ?? null;
              const gain = part != null && s.price != null && buyPrice != null ? part * (s.price - buyPrice) : null;
              return (
                <li key={s.portion}>
                  <div className="tp-plan-head">
                    <b>{s.portion}</b>
                    {s.price != null ? (
                      <span className="tp-target-price">
                        {money(s.price, sym)}
                        {s.pct_from_now != null && (
                          <span className="tp-map-diff">
                            {s.pct_from_now >= 0 ? "+" : ""}
                            {s.pct_from_now}%
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="muted" style={{ fontSize: 12 }}>—</span>
                    )}
                  </div>
                  {/* Jumlah nyata dari portofolio: "jual berapa lot di harga berapa". */}
                  {part != null && (
                    <div className="tp-plan-qty">
                      {i === 2 && s.price != null ? (
                        <>
                          Sisakan <b>{qtyText(part, sym)}</b> — jual hanya bila turun ke {money(s.price, sym)}
                        </>
                      ) : (
                        <>
                          Jual <b>{qtyText(part, sym)}</b>
                          {s.price != null && (
                            <>
                              {" "}
                              di {money(s.price, sym)} → terima <b>{money(part * s.price, sym)}</b>
                            </>
                          )}
                        </>
                      )}
                      {gain != null && (
                        <span className={gain >= 0 ? "up" : "down"}>
                          {" "}
                          · {gain >= 0 ? "untung" : "rugi"} {money(Math.abs(gain), sym)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="p-sum">{s.note}</div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <p className="muted" style={{ fontSize: 12, margin: "12px 0 0", lineHeight: 1.5 }}>
        {data.disclaimer}
      </p>

      {onOpenReferences && (
        <button type="button" className="btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={onOpenReferences}>
          🎓 Lihat sumber riset lengkap
        </button>
      )}
    </div>
  );
}
