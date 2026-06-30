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
  const boxRef = useRef<HTMLDivElement>(null);

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
    const q: TickerQuery = {
      ticker: (next?.ticker ?? ticker).trim().toUpperCase(),
      interval: nextInterval,
      range: clampRange(nextInterval, next?.range ?? range),
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

      <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
        {INTERVAL_LOOKBACK_NOTE[interval]}
      </p>
    </div>
  );
}
