// Kekuatan Tren — momentum over 1/3/6 months as three separate numbers, plus a
// "Minat Beli" volume-confirmation read. All copy/numbers come from the backend.
import type { MomentumResponse, Week52Position } from "../types";
import { InfoTip } from "./ui";

const DIR_EMOJI: Record<string, string> = { naik: "🟢", turun: "🔴", datar: "⚪" };

const TIP =
  "3 angka terpisah (bukan 1) agar terlihat apakah tren baru mulai atau sudah lama. " +
  "Semua positif = tren kuat & berjalan; hanya 1 bulan positif = baru berbalik naik.";

const W52_TIP =
  "Posisi harga sekarang di antara titik terendah dan tertinggi 52 minggu terakhir. " +
  "Riset George & Hwang (2004, Journal of Finance) menemukan kedekatan ke puncak 52 minggu " +
  "memprediksi return lebih baik daripada return masa lalu — investor memakainya sebagai " +
  "'jangkar' dan telat bereaksi pada kabar baik. Ini bahan pertimbangan, BUKAN ajakan beli.";

const W52_EMOJI: Record<string, string> = { near_high: "🟢", middle: "⚪", near_low: "🔴" };
const W52_LABEL: Record<string, string> = {
  near_high: "Dekat puncak 52 minggu",
  middle: "Di tengah rentang 52 minggu",
  near_low: "Dekat dasar 52 minggu",
};

// Meteran posisi harga dalam rentang 52 minggu: batang dasar→puncak dengan
// penanda di posisi harga sekarang.
function Week52Gauge({ w }: { w: Week52Position }) {
  if (!w.enough_data || w.range_pos == null) {
    return (
      <div className="p-sum" style={{ marginTop: 8 }}>
        ⚪ Rentang 52 minggu: belum cukup data harga (butuh ±6 bulan riwayat).
      </div>
    );
  }
  const pos = Math.min(100, Math.max(0, w.range_pos));
  const tone = w.zone === "near_high" ? "good" : w.zone === "near_low" ? "bad" : "";
  return (
    <div style={{ marginTop: 10 }}>
      <div className="p-head" style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 13.5 }}>🎯 Posisi 52 Minggu</span>
        <InfoTip text={W52_TIP} />
      </div>

      <div className={`w52 ${tone}`}>
        <div className="w52-track">
          <div className="w52-fill" style={{ width: `${pos}%` }} />
          <div className="w52-marker" style={{ left: `${pos}%` }} />
        </div>
        <div className="w52-ends">
          <span>Terendah{w.low != null ? ` ${w.low.toLocaleString("id-ID")}` : ""}</span>
          <span>Tertinggi{w.high != null ? ` ${w.high.toLocaleString("id-ID")}` : ""}</span>
        </div>
      </div>

      <div className="p-sum" style={{ marginTop: 6 }}>
        {W52_EMOJI[w.zone ?? "middle"]} <b>{W52_LABEL[w.zone ?? "middle"]}</b>
        {w.pct_of_high != null && <> — harga sekarang {w.pct_of_high}% dari puncak 52 minggu.</>}
      </div>
      <div className="p-sum" style={{ marginTop: 2 }}>{w.text}</div>
    </div>
  );
}

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

      {data.week52 && <Week52Gauge w={data.week52} />}
    </div>
  );
}
