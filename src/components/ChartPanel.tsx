import { useCallback, useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, IndicatorSeries, Pattern } from "../types";
import { colorFor } from "../indicators";

// A named indicator line plus whether it belongs on the price pane (overlay)
// or the bottom oscillator pane.
export interface SeriesLine extends IndicatorSeries {
  overlay: boolean;
}

// TradingView-style MACD histogram colours (green above zero, red below).
const HIST_UP = "#26a69a";
const HIST_DOWN = "#ef5350";

// Canonical colours for the well-known oscillator lines, matching TradingView's
// defaults; anything else falls back to the hashed palette.
function lineColor(name: string): string {
  if (name === "MACD") return "#2962ff"; // MACD line — blue
  if (name === "MACD_signal") return "#ff6d00"; // signal — orange
  if (/^RSI_/.test(name)) return "#7e57c2"; // RSI — purple
  return colorFor(name);
}

// The MACD "diff" line is drawn as a histogram (bars), like TradingView; every
// other oscillator series is a line. Series names are deterministic (backend).
function isHistogram(name: string): boolean {
  return /_hist$/i.test(name);
}

// Which stacked oscillator pane a series lives in. Each indicator *instance*
// gets its OWN pane (so RSI_14 and RSI_28 don't share one band), but the several
// lines of a single MACD instance (MACD / MACD_signal / MACD_hist) stay together.
function oscPane(name: string): string {
  if (/^MACD/.test(name)) return "MACD"; // all MACD lines → one pane
  return name; // RSI_14, RSI_28, ATR_14 … each its own pane
}

// Drop warm-up nulls so the line doesn't draw a gap to zero. time+value align 1:1.
function toLineData(s: IndicatorSeries): LineData[] {
  const out: LineData[] = [];
  for (let i = 0; i < s.time.length; i++) {
    const v = s.value[i];
    if (v != null) out.push({ time: s.time[i] as UTCTimestamp, value: v });
  }
  return out;
}

// Histogram points carry a per-bar colour so the bars flip green/red at zero.
function toHistData(s: IndicatorSeries): HistogramData[] {
  const out: HistogramData[] = [];
  for (let i = 0; i < s.time.length; i++) {
    const v = s.value[i];
    if (v != null) out.push({ time: s.time[i] as UTCTimestamp, value: v, color: v >= 0 ? HIST_UP : HIST_DOWN });
  }
  return out;
}

export default function ChartPanel({
  candles,
  lines,
  patterns = [],
  buyPrice = null,
}: {
  candles: Candle[];
  lines: SeriesLine[];
  patterns?: Pattern[];
  // Harga beli rata-rata dari portofolio (null = saham ini tidak dimiliki).
  buyPrice?: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // Horizontal line marking the latest ("current") price; redrawn each update.
  const nowLineRef = useRef<IPriceLine | null>(null);
  // Horizontal line marking the user's average buy price (from the portfolio).
  const buyLineRef = useRef<IPriceLine | null>(null);
  // Candle count last fitted to view — so auto-refresh updates don't reset zoom.
  const fittedLenRef = useRef(0);
  // Active indicator series keyed by name, so we add/remove only what changed.
  const lineRefs = useRef<Map<string, ISeriesApi<"Line" | "Histogram">>>(new Map());
  // Which indicator set is currently built (signature) — rebuild panes only when
  // the set of indicators changes, not on every data-refresh tick.
  const sigRef = useRef("");
  // Pattern markers primitive (v5 moved markers off the series itself).
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers<Time>> | null>(null);

  // Pan/zoom the visible window by fractions of its current span. zoom>0 zooms in
  // (shrinks both edges), pan shifts both edges left(<0)/right(>0).
  const nudge = useCallback((zoom: number, pan: number) => {
    const ts = chartRef.current?.timeScale();
    const r = ts?.getVisibleLogicalRange();
    if (!ts || !r) return;
    const span = r.to - r.from;
    ts.setVisibleLogicalRange({ from: r.from + span * (zoom + pan), to: r.to - span * (zoom - pan) });
  }, []);
  // Reset = snap to the latest bars, zoomed in for readability (with a little
  // empty space on the right), rather than fitting the whole history.
  const resetView = useCallback(() => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const total = fittedLenRef.current;
    const bars = 90; // recent window width
    const margin = 12; // future-side breathing room, like the live view
    ts.setVisibleLogicalRange({ from: Math.max(0, total - bars), to: total + margin });
  }, []);

  // Alt+R resets the view, matching the toolbar button's hint.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [resetView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { color: "#ffffff" }, textColor: "#66708a", fontFamily: "Segoe UI, system-ui, sans-serif" },
      grid: { vertLines: { color: "#eef1f8" }, horzLines: { color: "#eef1f8" } },
      timeScale: { timeVisible: true, borderColor: "#e3e8f3" },
      rightPriceScale: { borderColor: "#e3e8f3" },
      crosshair: { vertLine: { color: "#b6bed4", labelBackgroundColor: "#4f46e5" }, horzLine: { color: "#b6bed4", labelBackgroundColor: "#4f46e5" } },
    });
    chartRef.current = chart;
    // Green = price closed higher than it opened; red = closed lower.
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });
    candleRef.current.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.08 } });
    markersRef.current = createSeriesMarkers(candleRef.current, []);
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      markersRef.current = null;
      lineRefs.current.clear();
      sigRef.current = "";
    };
  }, []);

  useEffect(() => {
    const data: CandlestickData[] = candles.map((c) => {
      const bar: CandlestickData = {
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
      // Pre/post-market bars: dim to amber so they read as "outside regular hours"
      // rather than as ordinary up/down candles.
      if (c.extended) {
        bar.color = "#f59e0b";
        bar.borderColor = "#f59e0b";
        bar.wickColor = "#f59e0b";
      }
      return bar;
    });
    candleRef.current?.setData(data);
    // Only fit when the series shape changes (new ticker/range), so a silent
    // auto-refresh tick that just updates the last candle keeps the user's zoom.
    if (data.length !== fittedLenRef.current) {
      chartRef.current?.timeScale().fitContent();
      fittedLenRef.current = data.length;
    }

    // Mark the latest close as the live "current price" so it stays readable
    // even when the candle is tiny or the view is zoomed out.
    const series = candleRef.current;
    if (series) {
      if (nowLineRef.current) series.removePriceLine(nowLineRef.current);
      const last = candles[candles.length - 1];
      if (last) {
        const up = last.close >= last.open;
        nowLineRef.current = series.createPriceLine({
          price: last.close,
          color: up ? "#16a34a" : "#dc2626",
          lineWidth: 1,
          lineStyle: 2, // dashed
          axisLabelVisible: true,
          title: "Harga sekarang",
        });
      }
    }
  }, [candles]);

  // Draw/refresh the "harga beli kamu" line when this ticker is in the portfolio.
  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;
    if (buyLineRef.current) {
      series.removePriceLine(buyLineRef.current);
      buyLineRef.current = null;
    }
    if (buyPrice != null) {
      buyLineRef.current = series.createPriceLine({
        price: buyPrice,
        color: "#4f46e5",
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: "📌 Harga beli kamu",
      });
    }
  }, [buyPrice]);

  // Reconcile indicator series with `lines`. Each oscillator group (MACD, RSI,
  // ATR) lives in its OWN pane below the price pane — real stacked sub-charts
  // like TradingView (v5 panes), not overlapping strips. Panes are only rebuilt
  // when the indicator SET changes; a plain data-refresh just re-feeds the data.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const refs = lineRefs.current;

    // Signature of the active indicator set (names + overlay), ignoring values.
    const sig = lines.map((l) => `${l.name}:${l.overlay ? 1 : 0}`).sort().join("|");
    if (sig !== sigRef.current) {
      for (const [, series] of refs) chart.removeSeries(series);
      refs.clear();

      // Distinct oscillator panes present, in first-seen order → pane index
      // (price pane = 0). Each indicator instance is its own pane.
      const present: string[] = [];
      for (const l of lines) {
        if (l.overlay) continue;
        const g = oscPane(l.name);
        if (!present.includes(g)) present.push(g);
      }
      const paneOf = (line: SeriesLine) => (line.overlay ? 0 : 1 + present.indexOf(oscPane(line.name)));

      for (const line of lines) {
        const pane = paneOf(line);
        let series: ISeriesApi<"Line" | "Histogram">;
        if (isHistogram(line.name)) {
          series = chart.addSeries(HistogramSeries, { base: 0, priceLineVisible: false, lastValueVisible: false }, pane);
        } else {
          series = chart.addSeries(LineSeries, { color: lineColor(line.name), lineWidth: 2, priceLineVisible: false, lastValueVisible: false }, pane);
          // RSI overbought/oversold guides, like TradingView's 70/30 dashes.
          if (/^RSI_/.test(line.name)) {
            series.createPriceLine({ price: 70, color: "#ef5350", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
            series.createPriceLine({ price: 30, color: "#26a69a", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });
          }
        }
        refs.set(line.name, series);
      }

      // Give the price pane ~60% of the height; oscillator panes split the rest.
      const nOsc = present.length;
      if (nOsc > 0) {
        const panes = chart.panes();
        panes[0]?.setStretchFactor(nOsc * 1.6);
        for (let i = 1; i <= nOsc; i++) panes[i]?.setStretchFactor(1);
      }
      sigRef.current = sig;
    }

    // Always refresh the data (this is the per-tick path).
    for (const line of lines) {
      const series = refs.get(line.name);
      if (!series) continue;
      if (isHistogram(line.name)) (series as ISeriesApi<"Histogram">).setData(toHistData(line));
      else (series as ISeriesApi<"Line">).setData(toLineData(line));
    }
  }, [lines]);

  // Drop detected-pattern markers (▲ bullish below bar, ▼ bearish above bar) on
  // the relevant bars, grouping patterns that share a bar into one marker.
  useEffect(() => {
    if (!markersRef.current) return;
    const byTime = new Map<number, Pattern[]>();
    for (const p of patterns) {
      if (p.at == null) continue;
      const arr = byTime.get(p.at) ?? [];
      arr.push(p);
      byTime.set(p.at, arr);
    }
    const markers: SeriesMarker<Time>[] = [...byTime.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([time, ps]) => {
        const bearish = ps.some((p) => p.kind === "bearish");
        const bullish = ps.some((p) => p.kind === "bullish");
        const kind = bearish && !bullish ? "bearish" : bullish && !bearish ? "bullish" : "neutral";
        return {
          time: time as UTCTimestamp,
          position: kind === "bearish" ? "aboveBar" : "belowBar",
          color: kind === "bearish" ? "#dc2626" : kind === "bullish" ? "#16a34a" : "#64748b",
          shape: kind === "bearish" ? "arrowDown" : kind === "bullish" ? "arrowUp" : "circle",
          text: ps.map((p) => p.label).join(", "),
        };
      });
    markersRef.current.setMarkers(markers);
  }, [patterns, candles]);

  // Fill the chart column (parent is flex). autoSize keeps the canvas in sync.
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div className="chart-tools">
        <button type="button" onClick={() => nudge(-0.1, 0)} title="Perkecil (zoom out)">−</button>
        <button type="button" onClick={() => nudge(0.1, 0)} title="Perbesar (zoom in)">+</button>
        <button type="button" onClick={() => nudge(0, -0.2)} title="Geser ke kiri">‹</button>
        <button type="button" onClick={() => nudge(0, 0.2)} title="Geser ke kanan">›</button>
        <button type="button" onClick={resetView} title="Reset tampilan grafik (Alt + R)">
          ↺<span className="kbd">Alt + R</span>
        </button>
      </div>
    </div>
  );
}
