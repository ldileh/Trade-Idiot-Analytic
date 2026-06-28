import { useEffect, useState } from "react";
import { getPrices, postIndicators } from "./api/client";
import BacktestPanel from "./components/BacktestPanel";
import ChartPanel, { type SeriesLine } from "./components/ChartPanel";
import IndicatorControls from "./components/IndicatorControls";
import PriceSummary from "./components/PriceSummary";
import TickerInput, { type TickerQuery } from "./components/TickerInput";
import { Card, SectionHead } from "./components/ui";
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
        if (res.candles.length === 0) setError(`Tidak ada data untuk ${query.ticker}. Cek lagi kode sahamnya, ya.`);
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

  const hasData = candles.length > 0;

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo">📈</span>
        <div>
          <h1>Trade-Idiot-Analytic</h1>
          <p>Belajar membaca grafik saham &amp; menguji strategi — dijelaskan dengan bahasa sederhana.</p>
        </div>
      </header>

      {/* Langkah 1 — pilih saham */}
      <Card>
        <SectionHead
          step={1}
          title="Pilih saham yang mau dilihat"
          subtitle="Ketik kode saham (atau klik salah satu tombol cepat), lalu atur jangka waktunya."
        />
        <TickerInput value={query} loading={loading} onSubmit={setQuery} />
        {loading && <div className="loading-bar" style={{ marginTop: 14 }} />}
        {error && <div className="alert" role="alert">{error}</div>}
        {hasData && (
          <div style={{ marginTop: 16 }}>
            <PriceSummary ticker={query.ticker} candles={candles} />
          </div>
        )}
      </Card>

      {/* Langkah 2 — indikator + chart */}
      <Card>
        <SectionHead
          step={2}
          title="Tambah alat bantu (indikator)"
          subtitle="Indikator adalah garis bantu di atas grafik untuk membaca arah harga. Klik kartu untuk menyalakan/mematikan — tidak perlu paham semuanya."
        />
        <IndicatorControls active={specs} onAdd={addSpec} onRemove={removeSpec} />

        <div className="legend" style={{ marginTop: 18 }}>
          <span className="dot"><span className="sq" style={{ background: "var(--up)" }} /> Lilin hijau = harga <b>naik</b> di periode itu</span>
          <span className="dot"><span className="sq" style={{ background: "var(--down)" }} /> Lilin merah = harga <b>turun</b></span>
          <span className="dot muted">Tarik/geser grafik untuk menjelajah, scroll untuk zoom.</span>
        </div>
        <div className="chart-wrap fade" style={{ opacity: loading ? 0.5 : 1 }}>
          {hasData ? (
            <ChartPanel candles={candles} lines={lines} />
          ) : (
            <div className="empty">Belum ada data. Pilih saham di Langkah 1 dulu, ya. 👆</div>
          )}
        </div>
      </Card>

      {/* Langkah 3 — backtest */}
      <Card>
        <SectionHead
          step={3}
          title="Uji sebuah strategi (backtest)"
          subtitle="Penasaran “kalau dari dulu pakai strategi ini, untung nggak?” Pilih strategi, jalankan, dan baca hasilnya yang sudah diterjemahkan."
        />
        <BacktestPanel ticker={query.ticker} interval={query.interval} range={query.range} />
      </Card>
    </div>
  );
}
