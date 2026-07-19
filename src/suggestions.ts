// Educational action hints for a portfolio holding. Combines the same /patterns
// engine the chart uses (bullish vs bearish pattern count → trend lean), the
// position's own profit/loss %, and recent-news sentiment (keyword count from
// /news). NOT financial advice — a beginner-friendly nudge to think, not a
// signal to trade.
import type { PatternsResponse } from "./types";

export type ActionKind = "add" | "hold" | "watch" | "trim" | "sell";

export interface Suggestion {
  action: ActionKind;
  label: string; // short beginner label, e.g. "Bisa tambah"
  why: string; // one-line reason with the numbers behind it
}

export const ACTION_LABEL: Record<ActionKind, string> = {
  add: "🟢 Bisa tambah",
  hold: "🟩 Tahan",
  watch: "⬜ Amati saja",
  trim: "🟧 Kurangi sebagian",
  sell: "🟥 Pertimbangkan jual",
};

// Decision cascade. `pnlPct` is the position's current gain/loss %, or null if
// the live price hasn't loaded. `newsSentiment` is the summed /news lexicon
// score (>0 good flow, <0 bad); it nudges the trend lean by at most ±1 so news
// alone can't override a clear price pattern. ponytail: flat heuristic
// thresholds, not a model — tune the numbers if the mix of calls feels off.
export function suggest(p: PatternsResponse, pnlPct: number | null, newsSentiment = 0): Suggestion {
  const bull = p.patterns.filter((x) => x.kind === "bullish").length;
  const bear = p.patterns.filter((x) => x.kind === "bearish").length;
  const newsNudge = Math.sign(newsSentiment); // -1 | 0 | +1
  const net = bull - bear + newsNudge;
  const pnl = pnlPct ?? 0;
  const pnlTxt = pnlPct == null ? "" : ` (posisi ${pnl >= 0 ? "+" : ""}${pnl.toFixed(1)}%)`;
  const newsTxt = newsNudge > 0 ? " Berita terkini cenderung positif." : newsNudge < 0 ? " Berita terkini cenderung negatif." : "";

  const done = (action: ActionKind, why: string): Suggestion => ({ action, label: ACTION_LABEL[action], why: why + newsTxt });

  // Trend leaning down.
  if (net <= -1 || p.bias === "bearish") {
    if (pnl <= -8) return done("sell", `Pola condong turun & sudah rugi${pnlTxt}. Pikirkan batasi rugi (cut loss).`);
    return done("trim", `Pola mulai melemah${pnlTxt}. Amankan sebagian selagi bisa.`);
  }

  // Trend leaning up.
  if (net >= 1 || p.bias === "bullish") {
    if (pnl >= 20) return done("hold", `Pola masih naik & sudah untung${pnlTxt}. Tahan, boleh amankan sebagian (trailing).`);
    if (pnl <= -5) return done("add", `Pola tetap condong naik walau lagi rugi${pnlTxt}. Bisa rata-rata (average) — kelola risiko.`);
    return done("hold", `Pola condong naik${pnlTxt}. Tahan; boleh tambah bertahap.`);
  }

  // Mixed / no clear lean.
  if (pnl <= -12) return done("trim", `Pola belum jelas tapi rugi cukup dalam${pnlTxt}. Pertimbangkan kurangi risiko.`);
  return done("watch", `Pola belum berpihak${pnlTxt}. Amati dulu sampai arah jelas.`);
}
