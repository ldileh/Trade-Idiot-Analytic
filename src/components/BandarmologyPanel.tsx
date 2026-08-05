// "Jejak Bandar" — proksi akumulasi/distribusi dari pola harga-volume (Chaikin
// Money Flow + lonjakan volume) plus arah kepemilikan asing KSEI untuk saham
// IDX. Semua angka & teks datang dari backend.
//
// Penting: ini BUKAN Broker Summary. Data broker asli (siapa yang beli/jual)
// hanya tersedia lewat layanan berbayar IDX, jadi panel ini sengaja menonjolkan
// disclaimer supaya tidak dibaca sebagai jejak bandar yang sesungguhnya.
import { useEffect, useState } from "react";
import { getBandarmology } from "../api/client";
import type { BandarmologyResponse, Interval } from "../types";
import { InfoTip } from "./ui";

const FLOW_TONE: Record<string, string> = {
  akumulasi: "bullish",
  distribusi: "bearish",
  netral: "neutral",
};

const FOREIGN_EMOJI: Record<string, string> = { masuk: "🟢", keluar: "🔴", datar: "⚪" };

const TIP =
  "Chaikin Money Flow melihat di mana harga ditutup dalam rentang hariannya: makin sering " +
  "menutup dekat level tertinggi, makin kuat indikasi akumulasi (ada yang mengumpulkan). " +
  "Digabung dengan lonjakan volume dan arah kepemilikan asing KSEI.";

export default function BandarmologyPanel({
  open,
  ticker,
  interval = "1d",
}: {
  open: boolean;
  ticker: string;
  interval?: Interval;
}) {
  const [data, setData] = useState<BandarmologyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    getBandarmology(ticker, interval)
      .then((r) => !cancelled && setData(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, ticker, interval]);

  const isIDX = ticker.toUpperCase().endsWith(".JK");

  return (
    <div>
      {loading && <div className="loading-bar" />}
      {error && <p className="muted" style={{ fontSize: 13 }}>Gagal memuat: {error}</p>}

      {data && (
        <>
          <div className={`verdict ${data.flow === "akumulasi" ? "good" : data.flow === "distribusi" ? "bad" : ""}`}
               style={{ marginTop: 4, marginBottom: 12 }}>
            <span>{data.headline}</span>
          </div>

          <div className="p-head" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13.5 }}>💰 Aliran Dana (CMF)</span>
            <InfoTip text={TIP} />
          </div>
          <div className={`pattern ${FLOW_TONE[data.flow ?? "netral"] ?? "neutral"}`} style={{ marginBottom: 12 }}>
            <div className="p-sum" style={{ marginTop: 0 }}>{data.flow_text}</div>
          </div>

          <div className="p-head" style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 13.5 }}>📊 Keramaian Transaksi</span>
          </div>
          <div className={`pattern ${data.volume_spike ? "bullish" : "neutral"}`} style={{ marginBottom: 12 }}>
            <div className="p-sum" style={{ marginTop: 0 }}>{data.volume_text}</div>
          </div>

          {isIDX && (
            <>
              <div className="p-head" style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 800, fontSize: 13.5 }}>🌏 Arus Dana Asing (KSEI)</span>
              </div>
              <div
                className={`pattern ${
                  data.foreign_direction === "masuk"
                    ? "bullish"
                    : data.foreign_direction === "keluar"
                      ? "bearish"
                      : "neutral"
                }`}
                style={{ marginBottom: 12 }}
              >
                <div className="p-sum" style={{ marginTop: 0 }}>
                  {FOREIGN_EMOJI[data.foreign_direction ?? "datar"]} {data.foreign_text}
                </div>
              </div>
            </>
          )}

          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            ⚠️ {data.disclaimer}
          </p>
        </>
      )}
    </div>
  );
}
