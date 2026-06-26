import type { Interval, Range } from "../types";

const INTERVALS: Interval[] = ["1d", "1wk", "1mo", "1h", "30m", "15m", "5m", "1m"];
const RANGES: Range[] = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"];

export interface TickerQuery {
  ticker: string;
  interval: Interval;
  range: Range;
}

export default function TickerInput({
  value,
  loading,
  onSubmit,
}: {
  value: TickerQuery;
  loading: boolean;
  onSubmit: (q: TickerQuery) => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const ticker = (form.elements.namedItem("ticker") as HTMLInputElement).value
          .trim()
          .toUpperCase();
        if (!ticker) return;
        onSubmit({
          ticker,
          interval: (form.elements.namedItem("interval") as HTMLSelectElement).value as Interval,
          range: (form.elements.namedItem("range") as HTMLSelectElement).value as Range,
        });
      }}
      style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
    >
      <input
        name="ticker"
        defaultValue={value.ticker}
        placeholder="AAPL"
        aria-label="Ticker"
        autoComplete="off"
        style={{ textTransform: "uppercase", width: "8rem" }}
      />
      <select name="interval" defaultValue={value.interval} aria-label="Interval">
        {INTERVALS.map((i) => (
          <option key={i} value={i}>{i}</option>
        ))}
      </select>
      <select name="range" defaultValue={value.range} aria-label="Range">
        {RANGES.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <button type="submit" disabled={loading}>
        {loading ? "Loading…" : "Load"}
      </button>
    </form>
  );
}
