// Shared indicator metadata: which kinds overlay the price pane vs. live in a
// separate oscillator pane, plus a stable id/color per active indicator.
import type { IndicatorKind, IndicatorSpec } from "./types";

// Overlays share the price axis; oscillators get their own bottom-margined scale.
const OVERLAY_KINDS: ReadonlySet<IndicatorKind> = new Set(["sma", "ema", "bbands"]);

export function isOverlay(kind: IndicatorKind): boolean {
  return OVERLAY_KINDS.has(kind);
}

// The /indicators response is a flat list of named series (e.g. "EMA_20",
// "MACD_signal", "BB_upper_20"). Names are deterministic on the backend, so a
// prefix tells us whether the line overlays the price pane.
export function seriesIsOverlay(seriesName: string): boolean {
  return /^(SMA|EMA|BB)_/.test(seriesName);
}

// Stable key for an active indicator (kind+period) — used for dedupe and React keys.
export function specKey(spec: IndicatorSpec): string {
  return `${spec.kind}_${spec.period}`;
}

// Deterministic color per series name so a given line keeps its color across renders.
const PALETTE = ["#2962ff", "#e91e63", "#ff9800", "#43a047", "#8e24aa", "#00838f"];
export function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export const INDICATOR_KINDS: IndicatorKind[] = ["sma", "ema", "bbands", "rsi", "macd", "atr"];
