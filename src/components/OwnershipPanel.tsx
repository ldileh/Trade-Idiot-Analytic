// "Analisa Kepemilikan": KSEI Local/Foreign ownership for the current ticker.
// Shows the latest composition by investor type (proxy for the >1% owners view)
// and a Balance Position chart of the Local/Foreign split over time.
// IDX tickers only (KSEI data); non-IDX symbols return a friendly empty state.
import { useEffect, useState } from "react";
import { getOwnership } from "../api/client";
import type { OwnershipResponse } from "../types";
import BalancePositionChart from "./BalancePositionChart";

function fmtLot(lots: number): string {
  // KSEI counts shares; 1 lot = 100 shares. Show in lots, compactly.
  const l = lots / 100;
  if (l >= 1e9) return `${(l / 1e9).toFixed(1)}B lot`;
  if (l >= 1e6) return `${(l / 1e6).toFixed(1)}M lot`;
  if (l >= 1e3) return `${(l / 1e3).toFixed(1)}K lot`;
  return `${l.toFixed(0)} lot`;
}

export default function OwnershipPanel({ open, ticker }: { open: boolean; ticker: string }) {
  const [data, setData] = useState<OwnershipResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    getOwnership(ticker, 12)
      .then((r) => !cancelled && setData(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, ticker]);

  const isIDX = ticker.toUpperCase().endsWith(".JK");

  return (
    <div>
      {!isIDX && !loading && (
        <p className="muted" style={{ fontSize: 13 }}>
          Data kepemilikan hanya tersedia untuk saham IDX (kode berakhiran <b>.JK</b>).
          Pilih saham Indonesia untuk melihat analisa ini.
        </p>
      )}

      {loading && (
        <>
          <div className="loading-bar" />
          <p className="muted" style={{ fontSize: 13 }}>Mengambil data kepemilikan dari KSEI… (unduh & olah arsip bulanan)</p>
        </>
      )}
      {error && isIDX && <div className="alert" role="alert">{error}</div>}

      {data && (
        <>
          <div className="own-head">
            <span>Kepemilikan {data.ticker} per <b>{data.latest.date}</b></span>
            <span className="own-split">
              <span className="own-foreign">Asing {data.latest.pct_foreign.toFixed(1)}%</span>
              {" · "}
              <span className="own-local">Lokal {data.latest.pct_local.toFixed(1)}%</span>
            </span>
          </div>

          {/* Composition by investor type (proxy for >1% owners) */}
          <table className="own-table">
            <thead>
              <tr><th>Pemegang (per tipe)</th><th>Lot</th><th>%</th></tr>
            </thead>
            <tbody>
              {data.top_holders.slice(0, 8).map((h) => (
                <tr key={h.owner}>
                  <td>
                    <span className={`own-dot ${h.scope}`} /> {h.owner}
                  </td>
                  <td>{fmtLot(h.lots)}</td>
                  <td>{h.pct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 11.5 }}>
            *Diagregasi per tipe investor (Lokal/Asing) dari arsip KSEI — bukan nama entitas. Fitur eksperimental.
          </p>

          {/* Balance Position over time */}
          <h3 className="own-subtitle">Balance Position (Lokal vs Asing per bulan)</h3>
          {data.series.length > 1 ? (
            <>
              <BalancePositionChart series={data.series} />
              <div className="bal-legend">
                <span><span className="sq" style={{ background: "#8b5cf6" }} /> Lokal</span>
                <span><span className="sq" style={{ background: "#0d9488" }} /> Asing</span>
                <span><span className="sq" style={{ background: "#f59e0b" }} /> Garis = % Asing</span>
              </div>
            </>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>Belum cukup snapshot bulanan untuk grafik tren.</p>
          )}
        </>
      )}
    </div>
  );
}
