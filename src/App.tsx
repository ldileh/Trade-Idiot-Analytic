import { useEffect, useState } from "react";
import { getPatterns, getPrices, postIndicators } from "./api/client";
import BacktestPanel from "./components/BacktestPanel";
import ChartPanel, { type SeriesLine } from "./components/ChartPanel";
import IndicatorControls from "./components/IndicatorControls";
import PatternPanel from "./components/PatternPanel";
import PriceSummary from "./components/PriceSummary";
import TickerInput, { type TickerQuery } from "./components/TickerInput";
import { Card, Modal } from "./components/ui";
import { INDICATOR_INFO } from "./help";
import { seriesIsOverlay, specKey } from "./indicators";
import type { Candle, IndicatorSpec, PatternsResponse } from "./types";

const DEFAULT_QUERY: TickerQuery = { ticker: "AAPL", interval: "1d", range: "1y" };

export default function App() {
  const [query, setQuery] = useState<TickerQuery>(DEFAULT_QUERY);
  const [specs, setSpecs] = useState<IndicatorSpec[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lines, setLines] = useState<SeriesLine[]>([]);
  const [patterns, setPatterns] = useState<PatternsResponse | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);

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

  // Detected chart patterns follow the query (recomputed from current prices).
  useEffect(() => {
    let cancelled = false;
    setPatternsLoading(true);
    setPatterns(null);
    getPatterns(query.ticker, query.interval, query.range)
      .then((res) => !cancelled && setPatterns(res))
      .catch(() => !cancelled && setPatterns(null))
      .finally(() => !cancelled && setPatternsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Auto-refresh: silently refetch the latest candles + patterns so the chart &
  // price track the current market price. No loading bar, and the last good data
  // is kept on a transient failure, so the view never flickers. (Backend ~60s cache.)
  useEffect(() => {
    const id = setInterval(() => {
      getPrices(query.ticker, query.interval, query.range)
        .then((res) => res.candles.length > 0 && setCandles(res.candles))
        .catch(() => {});
      getPatterns(query.ticker, query.interval, query.range)
        .then((res) => setPatterns(res))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
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

      {/* Dua kolom: form pilih saham di samping (kiri), grafik utama (kanan) */}
      <div className="layout">
        {/* Kolom kiri — pilih saham + ringkasan harga */}
        <aside className="side">
          <Card>
            <TickerInput value={query} loading={loading} onSubmit={setQuery} />
            {loading && <div className="loading-bar" style={{ marginTop: 12 }} />}
            {error && <div className="alert" role="alert">{error}</div>}
            {hasData && (
              <div style={{ marginTop: 14 }}>
                <PriceSummary ticker={query.ticker} candles={candles} />
              </div>
            )}
          </Card>

          {hasData && (
            <Card>
              <PatternPanel data={patterns} loading={patternsLoading} />
            </Card>
          )}
        </aside>

        {/* Kolom kanan — grafik besar + alat */}
        <section className="main">
          <Card>
            <div className="toolbar">
              <div className="toolbar-left">
                <span className="legend">
                  <span className="dot"><span className="sq" style={{ background: "var(--up)" }} /> Lilin hijau = harga <b>naik</b></span>
                  <span className="dot"><span className="sq" style={{ background: "var(--down)" }} /> Lilin merah = harga <b>turun</b></span>
                </span>
                {specs.length > 0 && (
                  <span className="chips">
                    {specs.map((s) => (
                      <button key={specKey(s)} type="button" className="chip active" onClick={() => removeSpec(s)} title="Klik untuk matikan">
                        {INDICATOR_INFO[s.kind].emoji} {INDICATOR_INFO[s.kind].label} <span className="x">✕</span>
                      </button>
                    ))}
                  </span>
                )}
              </div>
              <div className="toolbar-right">
                <button type="button" className="btn-ghost" onClick={() => setShowIndicators(true)} disabled={!hasData}>
                  📊 Alat bantu {specs.length > 0 && <span className="count">{specs.length}</span>}
                </button>
                <button type="button" className="btn-primary" onClick={() => setShowBacktest(true)} disabled={!hasData}>
                  🧪 Uji strategi
                </button>
              </div>
            </div>

            <div className="chart-wrap fade" style={{ opacity: loading ? 0.5 : 1, marginTop: 12 }}>
              {hasData ? (
                <ChartPanel candles={candles} lines={lines} patterns={patterns?.patterns ?? []} />
              ) : (
                <div className="empty">Belum ada data. Cari & pilih saham di sebelah kiri dulu, ya. 👈</div>
              )}
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
              Tarik/geser grafik untuk menjelajah, scroll untuk zoom.
            </p>
          </Card>
        </section>
      </div>

      {/* Popup alat bantu (indikator) — drawer di pinggir kanan agar grafik tetap terlihat */}
      <Modal
        open={showIndicators}
        variant="drawer"
        title="📊 Alat bantu (indikator)"
        subtitle="Garis bantu untuk membaca arah harga. Klik kartu untuk menyalakan/mematikan — grafik di sebelah langsung berubah. Tidak perlu paham semuanya."
        onClose={() => setShowIndicators(false)}
      >
        <IndicatorControls active={specs} onAdd={addSpec} onRemove={removeSpec} />
      </Modal>

      {/* Popup uji strategi (backtest) */}
      <Modal
        open={showBacktest}
        title="🧪 Uji sebuah strategi (backtest)"
        subtitle="Penasaran “kalau dari dulu pakai strategi ini, untung nggak?” Pilih strategi, jalankan, dan baca hasilnya yang sudah diterjemahkan."
        onClose={() => setShowBacktest(false)}
      >
        <BacktestPanel ticker={query.ticker} interval={query.interval} range={query.range} />
      </Modal>
    </div>
  );
}
