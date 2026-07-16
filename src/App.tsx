import { useCallback, useEffect, useState } from "react";
import { getFundamentals, getMomentum, getPatterns, getPrices, postIndicators } from "./api/client";
import BacktestPanel from "./components/BacktestPanel";
import ChartPanel, { type SeriesLine } from "./components/ChartPanel";
import FundamentalsPanel from "./components/FundamentalsPanel";
import IndicatorControls from "./components/IndicatorControls";
import MomentumPanel from "./components/MomentumPanel";
import PatternPanel, { KIND_EMOJI } from "./components/PatternPanel";
import PriceSummary from "./components/PriceSummary";
import CorrelationPanel from "./components/CorrelationPanel";
import MarketMapPanel from "./components/MarketMapPanel";
import RecommendationsPanel from "./components/RecommendationsPanel";
import SettingsPanel from "./components/SettingsPanel";
import RRGPanel from "./components/RRGPanel";
import OwnershipPanel from "./components/OwnershipPanel";
import PortfolioPanel, { PositionSummary } from "./components/PortfolioPanel";
import TickerInput, { type TickerQuery } from "./components/TickerInput";
import { addHolding, loadHoldings, removeHolding, saveHoldings, type Holding } from "./portfolio";
import { Card, Menu, Modal } from "./components/ui";
import { INDICATOR_INFO } from "./help";
import { seriesIsOverlay, specKey } from "./indicators";
import type { Candle, FundamentalsResponse, IndicatorSpec, Interval, MomentumResponse, PatternsResponse, PricesResponse } from "./types";

const DEFAULT_QUERY: TickerQuery = { ticker: "AAPL", interval: "1d", range: "1y" };

// Auto-refresh cadence keyed to the candle timeframe: short candles refresh
// often, long ones rarely. Floored at 60s, capped at 5 min so the live price
// still moves intraday even on daily+ charts. (Backend caches ~60s.)
const REFRESH_MS: Record<Interval, number> = {
  "1m": 60_000,
  "5m": 120_000,
  "15m": 180_000,
  "30m": 240_000,
  "1h": 300_000,
  "1d": 300_000,
  "1wk": 300_000,
  "1mo": 300_000,
};

export default function App() {
  const [query, setQuery] = useState<TickerQuery>(DEFAULT_QUERY);
  const [specs, setSpecs] = useState<IndicatorSpec[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [source, setSource] = useState<PricesResponse["source"]>("yahoo");
  const [lines, setLines] = useState<SeriesLine[]>([]);
  const [patterns, setPatterns] = useState<PatternsResponse | null>(null);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [momentum, setMomentum] = useState<MomentumResponse | null>(null);
  const [fundamentals, setFundamentals] = useState<FundamentalsResponse | null>(null);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshedAt, setRefreshedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [showRRG, setShowRRG] = useState(false);
  const [showOwnership, setShowOwnership] = useState(false);
  const [showFundamentals, setShowFundamentals] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMarketMap, setShowMarketMap] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>(loadHoldings);

  // Mutasi portofolio selalu lewat sini agar localStorage ikut tersimpan.
  const updateHoldings = useCallback((next: Holding[]) => {
    saveHoldings(next);
    setHoldings(next);
  }, []);

  // Prices follow the ticker/interval/range query.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPrices(query.ticker, query.interval, query.range, query.prepost, query.realtime)
      .then((res) => {
        if (cancelled) return;
        setCandles(res.candles);
        setSource(res.source);
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
    setMomentum(null);
    getPatterns(query.ticker, query.interval, query.range)
      .then((res) => !cancelled && setPatterns(res))
      .catch(() => !cancelled && setPatterns(null))
      .finally(() => !cancelled && setPatternsLoading(false));
    // Kekuatan Tren (1/3/6mo) — always from 1y daily, independent of the chart range.
    getMomentum(query.ticker)
      .then((res) => !cancelled && setMomentum(res))
      .catch(() => !cancelled && setMomentum(null));
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Fundamentals depend only on the ticker (not interval/range), so refetch
  // just when the ticker changes.
  useEffect(() => {
    let cancelled = false;
    setFundamentalsLoading(true);
    setFundamentals(null);
    getFundamentals(query.ticker)
      .then((res) => !cancelled && setFundamentals(res))
      .catch(() => !cancelled && setFundamentals(null))
      .finally(() => !cancelled && setFundamentalsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query.ticker]);

  // Silently refetch the latest candles + patterns so the chart & price track the
  // current market price. No loading bar, and the last good data is kept on a
  // transient failure, so the view never flickers. Used by both the auto-refresh
  // timer and the manual refresh button.
  const refresh = useCallback(() => {
    setRefreshing(true);
    const started = Date.now();
    return Promise.allSettled([
      getPrices(query.ticker, query.interval, query.range, query.prepost, query.realtime).then(
        (res) => {
          if (res.candles.length > 0) setCandles(res.candles);
          setSource(res.source);
        },
      ),
      getPatterns(query.ticker, query.interval, query.range).then((res) => setPatterns(res)),
    ]).finally(() => {
      // Keep the spinner up at least 600ms so a cached (instant) refresh is still visible.
      setTimeout(() => {
        setRefreshedAt(Date.now());
        setRefreshing(false);
      }, Math.max(0, 600 - (Date.now() - started)));
    });
  }, [query]);

  // Auto-refresh on a cadence matching the candle timeframe.
  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS[query.interval]);
    return () => clearInterval(id);
  }, [refresh, query.interval]);

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
  // Posisi portofolio untuk saham yang sedang tampil (kalau dimiliki).
  const holding = holdings.find((h) => h.sym === query.ticker.trim().toUpperCase()) ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo">📈</span>
        <div>
          <h1>
            Trade-Idiot-Analytic <span className="app-version">v{__APP_VERSION__}</span>
          </h1>
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
                {holding && <PositionSummary holding={holding} last={candles[candles.length - 1].close} />}
                <span className={`source-badge ${source}`}>
                  {source === "finnhub" ? "● Finnhub realtime" : "● Yahoo Finance (±15 mnt)"}
                </span>
              </div>
            )}
          </Card>

        </aside>

        {/* Kolom kanan — grafik besar + alat */}
        <section className="main">
          <Card className="chart-card">
            <div className="toolbar">
              <div className="toolbar-left">
                <span className="legend">
                  <span className="dot"><span className="sq" style={{ background: "var(--up)" }} /> Lilin hijau = harga <b>naik</b></span>
                  <span className="dot"><span className="sq" style={{ background: "var(--down)" }} /> Lilin merah = harga <b>turun</b></span>
                </span>
              </div>
              <div className="toolbar-right">
                <button
                  type="button"
                  className="btn-ghost btn-icon"
                  onClick={() => refresh()}
                  disabled={!hasData || refreshing}
                  aria-label="Perbarui harga"
                  title={`Perbarui harga sekarang. Otomatis tiap ${Math.round(REFRESH_MS[query.interval] / 1000)} detik.${refreshedAt ? ` Terakhir: ${new Date(refreshedAt).toLocaleTimeString()}` : ""}`}
                >
                  <span className={refreshing ? "spin" : ""} aria-hidden style={{ display: "inline-block" }}>↻</span>
                </button>
                <span className="tb-sep" />
                {/* Grup Portofolio */}
                <span className="tb-group">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setShowPortfolio(true)} title="Catat saham yang kamu miliki. Saat saham itu tampil di grafik, garis harga beli & untung/rugi ikut muncul.">
                    💼 Portofolio {holdings.length > 0 && <span className="count">{holdings.length}</span>}
                  </button>
                </span>
                <span className="tb-sep" />
                {/* Grup Baca simbol (sering dipakai) */}
                <span className="tb-group">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setShowPatterns(true)} disabled={!hasData} title={patterns?.bias_text}>
                    🔍 Pola {patterns && KIND_EMOJI[patterns.bias]}
                    {patterns && patterns.patterns.length > 0 && <span className="count">{patterns.patterns.length}</span>}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setShowFundamentals(true)} disabled={!hasData} title={fundamentals?.bias_text}>
                    📒 Fundamental {fundamentals && <span className="count">{fundamentals.score}</span>}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setShowIndicators(true)} disabled={!hasData}>
                    📊 Alat bantu {specs.length > 0 && <span className="count">{specs.length}</span>}
                  </button>
                  <button type="button" className="btn-primary btn-sm" onClick={() => setShowBacktest(true)} disabled={!hasData}>
                    🧪 Uji strategi
                  </button>
                </span>
                <span className="tb-sep" />
                {/* Menu Jelajah — analisa lintas-saham yang lebih jarang dibuka */}
                <Menu label="🧭 Jelajah" title="Analisa lintas saham & pasar">
                  {(close) => (
                    <>
                      <button type="button" onClick={() => { setShowRecommendations(true); close(); }}>
                        ⭐ Rekomendasi
                      </button>
                      <button type="button" onClick={() => { setShowRRG(true); close(); }}>
                        ⚡ Arah Sektor
                      </button>
                      <button type="button" onClick={() => { setShowMarketMap(true); close(); }}>
                        🗺️ Peta Pasar
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowOwnership(true); close(); }}
                        disabled={!query.ticker.toUpperCase().endsWith(".JK")}
                        title={query.ticker.toUpperCase().endsWith(".JK") ? "Kepemilikan Lokal/Asing dari KSEI (saham IDX)" : "Hanya untuk saham IDX (.JK)"}
                      >
                        💰 Kepemilikan
                      </button>
                    </>
                  )}
                </Menu>
                {/* Menu Pengaturan */}
                <Menu label="⚙️" title="Pengaturan">
                  {(close) => (
                    <button type="button" onClick={() => { setShowSettings(true); close(); }} title="Sumber Data (BYOK)">
                      ⚙️ Sumber Data
                    </button>
                  )}
                </Menu>
              </div>
            </div>

            <div className="chart-wrap fade" style={{ opacity: loading ? 0.5 : 1, marginTop: 12 }}>
              {hasData ? (
                <ChartPanel candles={candles} lines={lines} patterns={patterns?.patterns ?? []} buyPrice={holding?.price ?? null} />
              ) : (
                <div className="empty">Belum ada data. Cari & pilih saham di sebelah kiri dulu, ya. 👈</div>
              )}
            </div>
            {specs.length > 0 && (
              <div className="active-indicators">
                <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Indikator aktif:</span>
                {specs.map((s) => (
                  <button key={specKey(s)} type="button" className="chip active" onClick={() => removeSpec(s)} title="Klik untuk matikan">
                    {INDICATOR_INFO[s.kind].emoji} {INDICATOR_INFO[s.kind].label} <span className="x">✕</span>
                  </button>
                ))}
              </div>
            )}
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

      {/* Popup pola terdeteksi — drawer di pinggir kanan agar penanda pola di grafik tetap terlihat */}
      <Modal
        open={showPatterns}
        variant="drawer"
        title="🔍 Pola terdeteksi"
        subtitle="Pola grafik klasik yang ditemukan otomatis dari harga yang sedang ditampilkan. Bahan bantu keputusan, BUKAN jaminan. Selalu kelola risiko."
        onClose={() => setShowPatterns(false)}
      >
        <MomentumPanel data={momentum} />
        <CorrelationPanel
          ticker={query.ticker}
          onPick={(sym) => {
            setQuery((q) => ({ ...q, ticker: sym }));
            setShowPatterns(false);
          }}
        />
        <PatternPanel data={patterns} loading={patternsLoading} />
      </Modal>

      {/* Popup fundamental — rasio valuasi/kesehatan/pertumbuhan + skor sehat */}
      <Modal
        open={showFundamentals}
        variant="drawer"
        title="📒 Analisa Fundamental"
        subtitle="Rasio keuangan perusahaan (valuasi, kesehatan, pertumbuhan) dengan skor sehat & penjelasan sederhana. Bahan bantu menilai 'isi' perusahaan, bukan grafiknya. BUKAN ajakan beli."
        onClose={() => setShowFundamentals(false)}
      >
        <FundamentalsPanel data={fundamentals} loading={fundamentalsLoading} />
      </Modal>

      {/* Popup rekomendasi — 10 saham paling bullish dari watchlist, dianalisa otomatis */}
      <Modal
        open={showRecommendations}
        variant="drawer"
        title="⭐ 10 Saham Rekomendasi"
        subtitle="App menganalisa daftar saham likuid pakai mesin Pola yang sama, lalu menampilkan 10 yang paling condong NAIK. Klik salah satu untuk membukanya di grafik. Bahan bantu, BUKAN ajakan beli — selalu kelola risiko."
        onClose={() => setShowRecommendations(false)}
      >
        <RecommendationsPanel
          open={showRecommendations}
          ticker={query.ticker}
          interval={query.interval}
          range={query.range}
          onPick={(sym) => {
            setQuery((q) => ({ ...q, ticker: sym }));
            setShowRecommendations(false);
          }}
        />
      </Modal>

      {/* Popup momentum relatif (RRG) — rotasi saham per sektor vs benchmark */}
      <Modal
        open={showRRG}
        variant="drawer"
        title="⚡ Peta Arah Sektor (RRG)"
        subtitle="Posisi tiap saham dibanding benchmark sektornya. Kanan-atas (Lagi Naik Daun) = kuat & menguat; kiri-bawah (Lagi Lesu) = lemah & melemah. Klik kode saham untuk membukanya di grafik."
        onClose={() => setShowRRG(false)}
      >
        <RRGPanel
          open={showRRG}
          ticker={query.ticker}
          onPick={(sym) => {
            setQuery((q) => ({ ...q, ticker: sym }));
            setShowRRG(false);
          }}
        />
      </Modal>

      {/* Popup analisa kepemilikan (KSEI) — komposisi Lokal/Asing + balance position */}
      <Modal
        open={showOwnership}
        variant="drawer"
        title="💰 Analisa Kepemilikan"
        subtitle="Komposisi pemegang saham Lokal vs Asing per tipe investor, dan tren Balance Position bulanan — dari arsip publik KSEI. Hanya untuk saham IDX (.JK). Data diagregasi per tipe, bukan nama entitas."
        onClose={() => setShowOwnership(false)}
      >
        <OwnershipPanel open={showOwnership} ticker={query.ticker} />
      </Modal>

      {/* Popup portofolio — catat kepemilikan; klik posisi untuk membukanya di grafik */}
      <Modal
        open={showPortfolio}
        variant="drawer"
        title="💼 Portofolio"
        subtitle="Catat saham yang kamu miliki: kode, jumlah lembar, dan harga beli. Saat saham itu tampil di grafik, garis 📌 harga beli & hitungan untung/rugi muncul otomatis. Data tersimpan di komputermu sendiri."
        onClose={() => setShowPortfolio(false)}
      >
        <PortfolioPanel
          holdings={holdings}
          onAdd={(sym, qty, price) => updateHoldings(addHolding(holdings, sym, qty, price))}
          onRemove={(sym) => updateHoldings(removeHolding(holdings, sym))}
          onPick={(sym) => {
            setQuery((q) => ({ ...q, ticker: sym }));
            setShowPortfolio(false);
          }}
        />
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

      {/* Popup Sumber Data (BYOK) — pilih provider per fitur + API key sendiri */}
      <Modal
        open={showSettings}
        variant="drawer"
        title="⚙️ Sumber Data"
        subtitle="Pilih dari mana data diambil per fitur: Default (gratis, sedikit tertunda) atau pakai API key milikmu sendiri untuk real-time. Key hanya disimpan di komputermu. Tanpa mengubah apa pun, app tetap jalan seperti biasa."
        onClose={() => setShowSettings(false)}
      >
        <SettingsPanel onClose={() => setShowSettings(false)} />
      </Modal>

      {/* Popup Peta Pasar — dialog besar; treemap favorit/portofolio/sektor */}
      <Modal
        open={showMarketMap}
        title="🗺️ Peta Pasar"
        subtitle="Sekilas apa yang naik/turun hari ini. Kotak besar = perusahaan besar (market cap), hijau = naik, merah = turun. Pilih daftar favorit, portofolio, atau satu sektor IDX. Klik kotak untuk membukanya di grafik."
        onClose={() => setShowMarketMap(false)}
      >
        <MarketMapPanel
          ticker={query.ticker}
          holdings={holdings}
          onPick={(sym) => {
            setQuery((q) => ({ ...q, ticker: sym }));
            setShowMarketMap(false);
          }}
        />
      </Modal>
    </div>
  );
}
