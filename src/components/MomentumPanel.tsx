// Kekuatan Tren — momentum over 1/3/6 months as three separate numbers, plus a
// "Minat Beli" volume-confirmation read. All copy/numbers come from the backend.
import type { MomentumResponse } from "../types";
import { InfoTip } from "./ui";

const DIR_EMOJI: Record<string, string> = { naik: "🟢", turun: "🔴", datar: "⚪" };

const TIP =
  "3 angka terpisah (bukan 1) agar terlihat apakah tren baru mulai atau sudah lama. " +
  "Semua positif = tren kuat & berjalan; hanya 1 bulan positif = baru berbalik naik.";

export default function MomentumPanel({ data }: { data: MomentumResponse | null }) {
  if (!data) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="p-head" style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 13.5 }}>📈 Kekuatan Tren</span>
        <InfoTip text={TIP} />
      </div>

      <div className="fund-list" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {data.readings.map((r) => (
          <div
            key={r.label}
            className={`pattern ${r.direction === "naik" ? "bullish" : r.direction === "turun" ? "bearish" : "neutral"}`}
            style={{ textAlign: "center" }}
          >
            <div className="p-sum" style={{ marginTop: 0 }}>{r.label}</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {r.enough_data ? `${DIR_EMOJI[r.direction!]} ${r.pct! > 0 ? "+" : ""}${r.pct}%` : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="p-sum" style={{ marginTop: 8 }}>{data.headline}</div>
      <div className="p-sum" style={{ marginTop: 2 }}>
        {data.volume_ok == null ? "⚪" : data.volume_ok ? "🟢" : "🔴"} {data.volume_text}
      </div>
    </div>
  );
}
