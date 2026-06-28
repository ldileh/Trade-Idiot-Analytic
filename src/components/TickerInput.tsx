import { useState } from "react";
import type { Interval, Range } from "../types";
import { INTERVAL_LABEL, RANGE_LABEL } from "../help";
import { InfoTip } from "./ui";

const INTERVALS: Interval[] = ["1d", "1wk", "1mo", "1h", "30m", "15m", "5m", "1m"];
const RANGES: Range[] = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"];

// A few well-known US tickers so a beginner can start with one click.
const POPULAR: { sym: string; name: string }[] = [
  { sym: "AAPL", name: "Apple" },
  { sym: "MSFT", name: "Microsoft" },
  { sym: "GOOGL", name: "Google" },
  { sym: "AMZN", name: "Amazon" },
  { sym: "TSLA", name: "Tesla" },
  { sym: "NVDA", name: "Nvidia" },
];

export interface TickerQuery {
  ticker: string;
  interval: Interval;
  range: Range;
}

// Controlled so quick-pick chips can update the ticker box live.
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
  const [interval, setInterval] = useState<Interval>(value.interval);
  const [range, setRange] = useState<Range>(value.range);

  function submit(next?: Partial<TickerQuery>) {
    const q: TickerQuery = {
      ticker: (next?.ticker ?? ticker).trim().toUpperCase(),
      interval: next?.interval ?? interval,
      range: next?.range ?? range,
    };
    if (!q.ticker) return;
    onSubmit(q);
  }

  return (
    <div>
      <div className="chips" style={{ marginBottom: 14 }}>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600, alignSelf: "center" }}>
          Coba cepat:
        </span>
        {POPULAR.map((p) => (
          <button
            key={p.sym}
            type="button"
            className={`chip${ticker.toUpperCase() === p.sym ? " active" : ""}`}
            title={p.name}
            onClick={() => {
              setTicker(p.sym);
              submit({ ticker: p.sym });
            }}
          >
            {p.sym}
          </button>
        ))}
      </div>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field" style={{ flex: "1 1 160px" }}>
          <span>
            Kode saham{" "}
            <InfoTip text="Kode singkat perusahaan di bursa Amerika. Contoh: AAPL = Apple, TSLA = Tesla. Ketik kodenya lalu tekan Tampilkan." />
          </span>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="contoh: AAPL"
            aria-label="Kode saham"
            autoComplete="off"
            style={{ textTransform: "uppercase" }}
          />
        </label>

        <label className="field" style={{ flex: "1 1 170px" }}>
          <span>
            1 batang lilin ={" "}
            <InfoTip text="Tiap batang lilin di grafik mewakili rentang waktu ini. '1 hari' artinya satu batang = pergerakan harga selama satu hari." />
          </span>
          <select value={interval} onChange={(e) => setInterval(e.target.value as Interval)} aria-label="Interval">
            {INTERVALS.map((i) => (
              <option key={i} value={i}>{INTERVAL_LABEL[i]}</option>
            ))}
          </select>
        </label>

        <label className="field" style={{ flex: "1 1 190px" }}>
          <span>
            Lihat ke belakang{" "}
            <InfoTip text="Seberapa jauh ke masa lalu data harga ditampilkan. Makin panjang, makin banyak sejarah yang terlihat." />
          </span>
          <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Range">
            {RANGES.map((r) => (
              <option key={r} value={r}>{RANGE_LABEL[r]}</option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn-primary" disabled={loading} style={{ flex: "0 0 auto", height: 42 }}>
          {loading ? "Memuat…" : "Tampilkan"}
        </button>
      </form>
    </div>
  );
}
