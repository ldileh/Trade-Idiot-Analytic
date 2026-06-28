import { useEffect, useRef } from "react";
import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, IndicatorSeries } from "../types";
import { colorFor } from "../indicators";

const OSC_SCALE = "osc"; // separate price scale id for oscillator pane

// A named indicator line plus whether it belongs on the price pane (overlay)
// or the bottom oscillator pane.
export interface SeriesLine extends IndicatorSeries {
  overlay: boolean;
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

export default function ChartPanel({
  candles,
  lines,
}: {
  candles: Candle[];
  lines: SeriesLine[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  // Active line series keyed by indicator series name, so we add/remove only what changed.
  const lineRefs = useRef<Map<string, ISeriesApi<"Line">>>(new Map());

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
    candleRef.current = chart.addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });
    // Push the price pane up so oscillators have room at the bottom.
    chart.priceScale("right").applyOptions({ scaleMargins: { top: 0.05, bottom: 0.3 } });
    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      lineRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleRef.current?.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Reconcile line series with the requested `lines`: create new, update existing,
  // drop removed. This is what lets indicators add/remove without a full reload.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const refs = lineRefs.current;
    const wanted = new Set(lines.map((l) => l.name));

    for (const [name, series] of refs) {
      if (!wanted.has(name)) {
        chart.removeSeries(series);
        refs.delete(name);
      }
    }

    for (const line of lines) {
      let series = refs.get(line.name);
      if (!series) {
        series = chart.addLineSeries({
          color: colorFor(line.name),
          lineWidth: 2,
          priceScaleId: line.overlay ? "right" : OSC_SCALE,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        refs.set(line.name, series);
      }
      series.setData(toLineData(line));
    }

    // Confine oscillator lines to the bottom strip below the price pane.
    if (lines.some((l) => !l.overlay)) {
      chart.priceScale(OSC_SCALE).applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
    }
  }, [lines]);

  return <div ref={containerRef} style={{ width: "100%", height: "520px" }} />;
}
