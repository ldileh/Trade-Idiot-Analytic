import { useEffect, useMemo, useRef, useState } from "react";
import type { Interval, Range } from "../types";
import { ALLOWED_RANGES, INTERVAL_LABEL, INTERVAL_LOOKBACK_NOTE, INTERVAL_ORDER, RANGE_LABEL } from "../help";
import type { Market } from "../stocks";
import { POPULAR_SYMS_BY_MARKET, STOCKS_BY_MARKET } from "../stocks";
import { InfoTip } from "./ui";

export interface TickerQuery {
  ticker: string;
  interval: Interval;
  range: Range;
  prepost?: boolean; // include US pre/post-market bars (intraday only)
  realtime?: boolean; // use Finnhub realtime latest price (US); false = Yahoo delayed
}

// Extended hours exist only for US intraday candles; daily+ and IDX have none.
const INTRADAY: Interval[] = ["1h", "30m", "15m", "5m", "1m"];

// Favorites are per-market and persisted in localStorage so they survive reloads.
const FAV_KEY = "favStocks";
function loadFavs(): Record<Market, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) || "{}");
    return { us: Array.isArray(v.us) ? v.us : [], id: Array.isArray(v.id) ? v.id : [] };
  } catch {
    return { us: [], id: [] };
  }
}

// Pick the look-back to keep when the interval changes: reuse the current range
// if it's still valid, otherwise fall back to the longest range that interval
// allows (so switching to a minute interval doesn't trigger a data error).
function clampRange(interval: Interval, range: Range): Range {
  const allowed = ALLOWED_RANGES[interval];
  return allowed.includes(range) ? range : allowed[allowed.length - 1];
}

// Controlled so quick-pick chips and the search list can update the box live.
export default function TickerInput({
  value,
  loading,
  onSubmit,
}: {
  value: TickerQuery;
  loading: boolean;
  onSubmit: (q: TickerQuery) => void;
}) {
  const [ticker, setTicker] = useState(value.ticker);
  const [interval, setIntervalState] = useState<Interval>(value.interval);
  const [range, setRange] = useState<Range>(value.range);
  const [open, setOpen] = useState(false);
  const [market, setMarket] = useState<Market>("us");
  const [favs, setFavs] = useState<Record<Market, string[]>>(loadFavs);
  const [prepost, setPrepost] = useState(value.prepost ?? false);
  const [realtime, setRealtime] = useState(value.realtime ?? true);
  const boxRef = useRef<HTMLDivElement>(null);

  // Pre/post-market only applies to US intraday candles.
  const prepostApplies = market === "us" && INTRADAY.includes(interval);
  // Finnhub realtime only affects US tickers (returns 0 for IDX .JK).
  const realtimeApplies = market === "us";

  const favSyms = favs[market];

  function toggleFav(sym: string) {
    setFavs((prev) => {
      const cur = prev[market];
      const next = cur.includes(sym) ? cur.filter((s) => s !== sym) : [...cur, sym];
      const all = { ...prev, [market]: next };
      localStorage.setItem(FAV_KEY, JSON.stringify(all));
      return all;
    });
  }

  // Follow the ticker when it's changed from outside (Rekomendasi/Momentum/
  // Kepemilikan picks set query.ticker) so the search box shows the new code.
  useEffect(() => {
    setTicker(value.ticker);
  }, [value.ticker]);

  const quickSyms = POPULAR_SYMS_BY_MARKET[market];

  const allowedRanges = ALLOWED_RANGES[interval];

  // Filter the selected market's list by symbol or company name as the user types.
  const matches = useMemo(() => {
    const list = STOCKS_BY_MARKET[market];
    const q = ticker.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) => s.sym.toLowerCase().includes(q) || s.name.toLowerCase().includes(q));
  }, [ticker, market]);

  // Close the search dropdown when clicking outside it.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function submit(next?: Partial<TickerQuery>) {
    const nextInterval = next?.interval ?? interval;
    const wantPrepost = next?.prepost ?? prepost;
    const q: TickerQuery = {
      ticker: (next?.ticker ?? ticker).trim().toUpperCase(),
      interval: nextInterval,
      range: clampRange(nextInterval, next?.range ?? range),
      // Only request extended hours where it applies (US intraday).
      prepost: market === "us" && INTRADAY.includes(nextInterval) && wantPrepost,
      realtime: next?.realtime ?? realtime,
    };
    if (!q.ticker) return;
    onSubmit(q);
  }

  function pickStock(sym: string) {
    setTicker(sym);
    setOpen(false);
    submit({ ticker: sym });
  }

  function changeInterval(next: Interval) {
    const nextRange = clampRange(next, range);
    setIntervalState(next);
    setRange(nextRange);
    submit({ interval: next, range: nextRange });
  }

  return (
    <div>
      <div className="chips" style={{ marginBottom: 10 }}>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
          Pasar:
        </span>
        <button
          type="button"
          className={`chip${market === "us" ? " active" : ""}`}
          onClick={() => setMarket("us")}
        >
          🇺🇸 Amerika (US)
        </button>
        <button
          type="button"
          className={`chip${market === "id" ? " active" : ""}`}
          onClick={() => setMarket("id")}
        >
          🇮🇩 Indonesia
        </button>
      </div>

      <div className="chips" style={{ marginBottom: 12 }}>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
          Coba cepat:
        </span>
        {quickSyms.map((sym) => (
          <button
            key={sym}
            type="button"
            className={`chip${ticker.toUpperCase() === sym ? " active" : ""}`}
            onClick={() => pickStock(sym)}
          >
            {sym}
          </button>
        ))}
      </div>

      {favSyms.length > 0 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
            ⭐ Favorit:
          </span>
          {favSyms.map((sym) => (
            <button
              key={sym}
              type="button"
              className={`chip${ticker.toUpperCase() === sym ? " active" : ""}`}
              onClick={() => pickStock(sym)}
            >
              {sym}
              <span
                className="x"
                role="button"
                aria-label={`Hapus ${sym} dari favorit`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFav(sym);
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          submit();
        }}
      >
        <label className="field" style={{ flex: "1 1 240px" }}>
          <span>
            Cari saham{" "}
            <InfoTip text="Ketik nama perusahaan (mis. 'Apple') atau kodenya (mis. 'AAPL'), lalu pilih dari daftar. Bisa juga ketik kode lain yang tidak ada di daftar." />
          </span>
          <div className="combo" ref={boxRef}>
            <input
              type="text"
              value={ticker}
              onChange={(e) => {
                setTicker(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="ketik nama atau kode, mis. Apple / AAPL"
              aria-label="Cari saham"
              autoComplete="off"
              style={{ textTransform: "uppercase" }}
            />
            {open && matches.length > 0 && (
              <ul className="combo-list" role="listbox">
                {matches.slice(0, 8).map((s) => (
                  <li key={s.sym}>
                    <button type="button" className="combo-item" onClick={() => pickStock(s.sym)}>
                      <span
                        className="fav-star"
                        role="button"
                        aria-label={favSyms.includes(s.sym) ? `Hapus ${s.sym} dari favorit` : `Tambah ${s.sym} ke favorit`}
                        title={favSyms.includes(s.sym) ? "Hapus dari favorit" : "Tambah ke favorit"}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFav(s.sym);
                        }}
                      >
                        {favSyms.includes(s.sym) ? "⭐" : "☆"}
                      </span>
                      <b>{s.sym}</b>
                      <span className="muted">{s.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </label>

        <label className="field" style={{ flex: "1 1 150px" }}>
          <span>
            1 batang lilin ={" "}
            <InfoTip text="Tiap batang lilin di grafik mewakili rentang waktu ini. '1 hari' artinya satu batang = pergerakan harga selama satu hari." />
          </span>
          <select value={interval} onChange={(e) => changeInterval(e.target.value as Interval)} aria-label="Interval">
            {INTERVAL_ORDER.map((i) => (
              <option key={i} value={i}>{INTERVAL_LABEL[i]}</option>
            ))}
          </select>
        </label>

        <label className="field" style={{ flex: "1 1 180px" }}>
          <span>
            Lihat ke belakang{" "}
            <InfoTip text="Seberapa jauh ke masa lalu data harga ditampilkan. Pilihan menyesuaikan jenis lilin: lilin menit hanya punya sejarah pendek." />
          </span>
          <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Range">
            {allowedRanges.map((r) => (
              <option key={r} value={r}>{RANGE_LABEL[r]}</option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn-primary" disabled={loading} style={{ flex: "0 0 auto", height: 42 }}>
          {loading ? "Memuat…" : "Tampilkan"}
        </button>
      </form>

      {prepostApplies && (
        <label className="prepost-toggle">
          <input
            type="checkbox"
            checked={prepost}
            onChange={(e) => {
              setPrepost(e.target.checked);
              submit({ prepost: e.target.checked });
            }}
          />
          <span>
            Tampilkan pra/pasca-pasar{" "}
            <InfoTip text="Sertakan perdagangan di luar jam bursa AS: sebelum buka (pra-pasar) dan sesudah tutup (pasca-pasar). Lilin di luar jam reguler ditandai berbeda di grafik. Hanya untuk saham AS dengan lilin per jam/menit." />
          </span>
        </label>
      )}

      {realtimeApplies && (
        <label className="prepost-toggle">
          <input
            type="checkbox"
            checked={realtime}
            onChange={(e) => {
              setRealtime(e.target.checked);
              submit({ realtime: e.target.checked });
            }}
          />
          <span>
            Harga realtime (Finnhub){" "}
            <InfoTip text="Harga terbaru saham AS dari Finnhub (realtime, jika API key di-set). Matikan untuk memakai harga Yahoo Finance yang tertunda ±15 menit. Tidak berlaku untuk saham Indonesia." />
          </span>
        </label>
      )}

      <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
        {INTERVAL_LOOKBACK_NOTE[interval]}
      </p>
    </div>
  );
}
