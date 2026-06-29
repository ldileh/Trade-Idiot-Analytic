// "Rekomendasi" panel: analyses a watchlist with the /patterns engine and lists
// the 10 most bullish picks, ranked. Click a row to load that stock on the main
// chart. Loads when first opened (and on interval/range change), not on mount.
import { useEffect, useState } from "react";
import { isIDX } from "../format";
import { getRecommendations, type Recommendation } from "../recommendations";
import type { Interval, Range } from "../types";
import { KIND_EMOJI } from "./PatternPanel";

export default function RecommendationsPanel({
  open,
  ticker,
  interval,
  range,
  onPick,
}: {
  open: boolean;
  ticker: string;
  interval: Interval;
  range: Range;
  onPick: (sym: string) => void;
}) {
  // Follow the current ticker's market: IDX (.JK) picks IDX blue chips, else US.
  const market = isIDX(ticker) ? "id" : "us";
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analyse only while the drawer is open, so we don't fan out ~20 requests in
  // the background on every app load. Re-runs if interval/range changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getRecommendations(market, interval, range, 10)
      .then((r) => !cancelled && setRecs(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, market, interval, range]);

  return (
    <div>
      {loading && (
        <>
          <div className="loading-bar" />
          <p className="muted" style={{ fontSize: 13 }}>Menganalisa saham pilihan… sebentar, ya.</p>
        </>
      )}
      {error && <div className="alert" role="alert">{error}</div>}

      {!loading && !error && recs.length === 0 && (
        <p className="muted" style={{ fontSize: 13 }}>Belum ada hasil. Coba buka lagi nanti.</p>
      )}

      {!loading && recs.length > 0 && (
        <ol className="rec-list">
          {recs.map((r, i) => (
            <li key={r.sym}>
              <button
                type="button"
                className={`rec ${r.bias}`}
                onClick={() => onPick(r.sym)}
                title={`${r.bias_text} — klik untuk buka di grafik`}
              >
                <span className="rec-rank">#{i + 1}</span>
                <span className="rec-main">
                  <span className="rec-sym">{KIND_EMOJI[r.bias]} {r.sym}</span>
                  <span className="rec-name">{r.name}</span>
                  {r.reasons.length > 0 && (
                    <span className="rec-reasons">{r.reasons.join(" · ")}</span>
                  )}
                </span>
                <span className="rec-score" title="Selisih pola naik vs turun">
                  {r.score > 0 ? `+${r.score}` : r.score}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
