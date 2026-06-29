// "Rekomendasi" feature: analyse a fixed watchlist of liquid stocks with the
// same /patterns engine the chart uses, then rank the most bullish ones. No new
// backend — it just fans out getPatterns() over the candidates and scores the
// returned bias + pattern mix. Educational signal, not financial advice.
import { getPatterns } from "./api/client";
import type { Interval, PatternKind, PatternsResponse, Range } from "./types";

// Candidate universe the app analyses: liquid IDX blue chips. IDX-only, to keep
// the app focused on the Indonesian market. Broad enough to surface 10 picks,
// small enough to stay fast (each is one /patterns call, ~60s-cached backend).
export const WATCHLIST: { sym: string; name: string }[] = [
  { sym: "BBCA.JK", name: "Bank Central Asia" },
  { sym: "BBRI.JK", name: "Bank Rakyat Indonesia" },
  { sym: "BMRI.JK", name: "Bank Mandiri" },
  { sym: "BBNI.JK", name: "Bank Negara Indonesia" },
  { sym: "BRIS.JK", name: "Bank Syariah Indonesia" },
  { sym: "TLKM.JK", name: "Telkom Indonesia" },
  { sym: "ASII.JK", name: "Astra International" },
  { sym: "UNVR.JK", name: "Unilever Indonesia" },
  { sym: "ICBP.JK", name: "Indofood CBP" },
  { sym: "INDF.JK", name: "Indofood Sukses Makmur" },
  { sym: "ANTM.JK", name: "Aneka Tambang" },
  { sym: "ADRO.JK", name: "Alamtri Resources" },
  { sym: "MDKA.JK", name: "Merdeka Copper Gold" },
  { sym: "PGAS.JK", name: "Perusahaan Gas Negara" },
  { sym: "GOTO.JK", name: "GoTo Gojek Tokopedia" },
  { sym: "AMRT.JK", name: "Sumber Alfaria Trijaya" },
  { sym: "KLBF.JK", name: "Kalbe Farma" },
  { sym: "CPIN.JK", name: "Charoen Pokphand Indonesia" },
  { sym: "JSMR.JK", name: "Jasa Marga" },
  { sym: "SMGR.JK", name: "Semen Indonesia" },
];

export interface Recommendation {
  sym: string;
  name: string;
  bias: PatternKind;
  bias_text: string;
  score: number; // bullish patterns minus bearish; higher = stronger buy lean
  bullish: number;
  bearish: number;
  reasons: string[]; // short labels of the bullish patterns found
}

// Net pattern score for one analysed stock: +1 per bullish pattern, -1 per
// bearish. Mirrors the backend's own bias math so ranking matches the Pola view.
function score(data: PatternsResponse): number {
  let s = 0;
  for (const p of data.patterns) {
    if (p.kind === "bullish") s += 1;
    else if (p.kind === "bearish") s -= 1;
  }
  return s;
}

export function toRecommendation(name: string, data: PatternsResponse): Recommendation {
  const bullish = data.patterns.filter((p) => p.kind === "bullish");
  const bearish = data.patterns.filter((p) => p.kind === "bearish");
  return {
    sym: data.ticker,
    name,
    bias: data.bias,
    bias_text: data.bias_text,
    score: score(data),
    bullish: bullish.length,
    bearish: bearish.length,
    reasons: bullish.map((p) => p.label),
  };
}

// Analyse the whole watchlist in parallel and return the top `limit` picks,
// most bullish first. Stocks that fail to load are skipped (not the whole run).
// Ties break on more bullish patterns, then symbol for stable ordering.
export async function getRecommendations(
  interval: Interval = "1d",
  range: Range = "1y",
  limit = 10,
): Promise<Recommendation[]> {
  const settled = await Promise.allSettled(
    WATCHLIST.map(async (s) => toRecommendation(s.name, await getPatterns(s.sym, interval, range))),
  );
  const recs = settled
    .filter((r): r is PromiseFulfilledResult<Recommendation> => r.status === "fulfilled")
    .map((r) => r.value);

  recs.sort(
    (a, b) => b.score - a.score || b.bullish - a.bullish || a.sym.localeCompare(b.sym),
  );
  return recs.slice(0, limit);
}
