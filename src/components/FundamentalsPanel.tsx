// Fundamental ratios (valuation / health / growth) with a composite health
// score. All numbers and plain-Indonesian copy come from the backend; here we
// just group by category and color-code each metric's verdict.
import type {
  AltmanScore,
  FundamentalMetric,
  FundamentalsResponse,
  PiotroskiScore,
} from "../types";
import { InfoTip } from "./ui";

const VERDICT_EMOJI: Record<number, string> = { 1: "🟢", 0: "⚪", [-1]: "🔴" };
const VERDICT_CLASS: Record<number, string> = { 1: "good", 0: "", [-1]: "bad" };

// Render order for the category groups.
const GROUPS = ["Valuasi", "Kesehatan", "Pertumbuhan"];

export default function FundamentalsPanel({
  data,
  loading,
}: {
  data: FundamentalsResponse | null;
  loading: boolean;
}) {
  return (
    <div>
      {loading && <div className="loading-bar" />}

      {data && (
        <>
          {(data.piotroski || data.altman) && (
            <div className="fund-list" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
              {data.piotroski && <PiotroskiCard s={data.piotroski} />}
              {data.altman && <AltmanCard s={data.altman} />}
            </div>
          )}

          <div className={`verdict ${VERDICT_CLASS[data.bias === "good" ? 1 : data.bias === "bad" ? -1 : 0]}`}
               style={{ marginTop: 4, marginBottom: 12 }}>
            <span className="emoji">{VERDICT_EMOJI[data.bias === "good" ? 1 : data.bias === "bad" ? -1 : 0]}</span>
            <span>
              <b>Skor sehat: {data.score}/100</b> — {data.bias_text}
            </span>
          </div>

          {GROUPS.map((group) => {
            const items = data.metrics.filter((m) => m.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} style={{ marginBottom: 14 }}>
                <h4 style={{ margin: "0 0 6px", fontSize: 13.5 }}>{group}</h4>
                <div className="fund-list">
                  {items.map((m) => (
                    <Metric key={m.key} m={m} />
                  ))}
                </div>
              </div>
            );
          })}

          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Sumber: Yahoo Finance. Angka fundamental bisa tertinggal dari laporan terbaru &amp; berbeda antar sumber.
            Bahan bantu, BUKAN ajakan beli.
          </p>
        </>
      )}
    </div>
  );
}

// Skor Kesehatan Keuangan (Piotroski, 0–9): higher = healthier.
function PiotroskiCard({ s }: { s: PiotroskiScore }) {
  const tone = !s.enough_data ? "neutral" : s.score! >= 7 ? "bullish" : s.score! <= 3 ? "bearish" : "neutral";
  const emoji = !s.enough_data ? "⚪" : s.score! >= 7 ? "🟢" : s.score! <= 3 ? "🔴" : "🟡";
  return (
    <div className={`pattern ${tone}`}>
      <div className="p-head">
        <span>{emoji} {s.label}</span>
        <InfoTip text={s.tip} />
      </div>
      <div className="p-sum">
        <b style={{ fontSize: 15 }}>{s.enough_data ? `${s.score}/${s.max}` : "tidak cukup data"}</b>
        {s.enough_data && (
          <span className="muted"> — {s.signals.filter((x) => x.pass).length} dari {s.signals.length} sinyal lolos</span>
        )}
      </div>
    </div>
  );
}

// Skor Risiko Bangkrut (Altman Z): safe / grey / distress zone.
function AltmanCard({ s }: { s: AltmanScore }) {
  const tone = s.zone === "safe" ? "bullish" : s.zone === "distress" ? "bearish" : "neutral";
  const emoji = s.zone === "safe" ? "🟢" : s.zone === "distress" ? "🔴" : s.zone === "grey" ? "🟡" : "⚪";
  return (
    <div className={`pattern ${tone}`}>
      <div className="p-head">
        <span>{emoji} {s.label}</span>
        <InfoTip text={s.tip} />
      </div>
      <div className="p-sum">
        <b style={{ fontSize: 15 }}>{s.enough_data ? s.score : "tidak cukup data"}</b>
        {s.enough_data && <span className="muted"> — {s.zone_text}</span>}
      </div>
    </div>
  );
}

function Metric({ m }: { m: FundamentalMetric }) {
  const v = m.value == null ? 0 : m.verdict;
  return (
    <div className={`pattern ${VERDICT_CLASS[v] || "neutral"}`}>
      <div className="p-head">
        <span>{VERDICT_EMOJI[v]} {m.label}</span>
        <InfoTip text={m.tip} />
      </div>
      <div className="p-sum">
        <b>{m.display}</b>
        {m.value != null && <span className="muted"> — {m.verdict_text}</span>}
      </div>
    </div>
  );
}
