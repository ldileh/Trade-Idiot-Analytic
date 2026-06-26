import { useEffect, useState } from "react";
import { getPrices } from "./api/client";
import ChartPanel from "./components/ChartPanel";
import TickerInput, { type TickerQuery } from "./components/TickerInput";
import type { Candle } from "./types";

const DEFAULT_QUERY: TickerQuery = { ticker: "AAPL", interval: "1d", range: "1y" };

export default function App() {
  const [query, setQuery] = useState<TickerQuery>(DEFAULT_QUERY);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPrices(query.ticker, query.interval, query.range)
      .then((res) => {
        if (cancelled) return;
        setCandles(res.candles);
        if (res.candles.length === 0) setError(`Tidak ada data untuk ${query.ticker}.`);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setCandles([]);
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Trade-Idiot-Analytic</h1>
      <TickerInput value={query} loading={loading} onSubmit={setQuery} />
      {error && (
        <p role="alert" style={{ color: "#b00020", marginTop: "1rem" }}>
          {error}
        </p>
      )}
      <div style={{ marginTop: "1rem", opacity: loading ? 0.5 : 1 }}>
        <ChartPanel candles={candles} />
      </div>
    </main>
  );
}
