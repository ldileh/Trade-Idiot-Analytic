import { useEffect, useRef } from "react";
import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle } from "../types";

// Renders a candlestick chart from /prices data. The chart instance is created
// once and only its data is updated, so re-renders (loading, new candles) don't
// thrash the DOM. Backend `time` is epoch seconds → UTCTimestamp directly.
export default function ChartPanel({ candles }: { candles: Candle[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Create the chart once; tear it down on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { color: "#ffffff" }, textColor: "#222" },
      grid: { vertLines: { color: "#f0f0f0" }, horzLines: { color: "#f0f0f0" } },
      timeScale: { timeVisible: true },
    });
    chartRef.current = chart;
    seriesRef.current = chart.addCandlestickSeries();
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push new data whenever candles change.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    series.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} style={{ width: "100%", height: "480px" }} />;
}
