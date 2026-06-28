// Detected chart patterns as a trading-decision hint. Shows an overall bias
// banner plus one card per pattern, color-coded bullish/bearish/neutral. All
// copy comes from the backend in plain Indonesian.
import type { Pattern, PatternsResponse } from "../types";
import { InfoTip } from "./ui";

export const KIND_EMOJI: Record<Pattern["kind"], string> = {
  bullish: "🟢",
  bearish: "🔴",
  neutral: "⚪",
};

export default function PatternPanel({ data, loading }: { data: PatternsResponse | null; loading: boolean }) {
  return (
    <div>
      {loading && <div className="loading-bar" />}

      {data && (
        <>
          <div className={`verdict ${data.bias === "bearish" ? "bad" : data.bias === "bullish" ? "good" : ""}`}
               style={{ marginTop: 4, marginBottom: 12 }}>
            <span className="emoji">{KIND_EMOJI[data.bias]}</span>
            <span>{data.bias_text}</span>
          </div>

          {data.patterns.length === 0 ? (
            <p className="muted" style={{ fontSize: 13 }}>Belum ada pola jelas pada periode ini.</p>
          ) : (
            <div className="pattern-list">
              {data.patterns.map((p) => (
                <div key={p.key} className={`pattern ${p.kind}`}>
                  <div className="p-head">
                    <span>{KIND_EMOJI[p.kind]} {p.label}</span>
                    <InfoTip text={p.detail} />
                  </div>
                  <div className="p-sum">{p.summary}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
