import { useEffect, useState } from "react";
import { getPrices, postIndicators } from "./api/client";
import ChartPanel, { type SeriesLine } from "./components/ChartPanel";
import IndicatorControls from "./components/IndicatorControls";
import TickerInput, { type TickerQuery } from "./components/TickerInput";
import { seriesIsOverlay, specKey } from "./indicators";
import type { Candle, IndicatorSpec } from "./types";

const DEFAULT_QUERY: TickerQuery = { ticker: "AAPL", interval: "1d", range: "1y" };

export default function App() {
  const [query, setQuery] = useState<TickerQuery>(DEFAULT_QUERY);
  const [specs, setSpecs] = useState<IndicatorSpec[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lines, setLines] = useState<SeriesLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prices follow the ticker/interval/range query.
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

  // Indicators follow both the query and the active spec list.
  useEffect(() => {
    if (specs.length === 0) {
      setLines([]);
      return;
    }
    let cancelled = false;
    postIndicators({
      ticker: query.ticker,
      interval: query.interval,
      range: query.range,
      indicators: specs,
    })
      .then((res) => {
        if (cancelled) return;
        setLines(res.series.map((s) => ({ ...s, overlay: seriesIsOverlay(s.name) })));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [query, specs]);

  function addSpec(spec: IndicatorSpec) {
    setSpecs((prev) =>
      prev.some((s) => specKey(s) === specKey(spec)) ? prev : [...prev, spec],
    );
  }
  function removeSpec(spec: IndicatorSpec) {
    setSpecs((prev) => prev.filter((s) => specKey(s) !== specKey(spec)));
  }

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "1.5rem", maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Trade-Idiot-Analytic</h1>
      <TickerInput value={query} loading={loading} onSubmit={setQuery} />
      <IndicatorControls active={specs} onAdd={addSpec} onRemove={removeSpec} />
      {error && (
        <p role="alert" style={{ color: "#b00020", marginTop: "1rem" }}>
          {error}
        </p>
      )}
      <div style={{ marginTop: "1rem", opacity: loading ? 0.5 : 1 }}>
        <ChartPanel candles={candles} lines={lines} />
      </div>
    </main>
  );
}
