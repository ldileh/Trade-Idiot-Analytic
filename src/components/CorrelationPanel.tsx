// Saham yang Gerak Bareng — saham lain yang biasanya naik-turun bersamaan dengan
// simbol aktif (dan yang berlawanan). Korelasi return harian 6 bulan dihitung di
// backend dari OHLCV ter-cache; di sini kita cuma memilih kandidat pembanding
// (anggota sektor simbol ini + watchlist pasarnya) dan menampilkan hasilnya
// dalam kata (Kuat/Sedang/Lemah), bukan angka mentah.
import { useEffect, useMemo, useState } from "react";
import { getCorrelation } from "../api/client";
import { isIDX } from "../format";
import { WATCHLIST_BY_MARKET } from "../recommendations";
import { SECTORS } from "../sectors";
import type { CorrelationPeer, CorrelationResponse } from "../types";
import { InfoTip } from "./ui";

const TIP =
  "Saham lain yang biasanya naik-turun bersamaan (searah) atau berlawanan dengan saham ini, " +
  "dilihat dari 6 bulan terakhir. Berguna untuk tahu apakah saham ini ikut sektornya atau bergerak sendiri.";

// Kandidat pembanding: anggota sektor yang memuat ticker + watchlist pasarnya.
function candidatePeers(ticker: string): string[] {
  const sym = ticker.trim().toUpperCase();
  const market = isIDX(sym) ? "id" : "us";
  const fromSectors = SECTORS.filter((s) => s.symbols.includes(sym)).flatMap((s) => s.symbols);
  const fromWatch = WATCHLIST_BY_MARKET[market].map((w) => w.sym);
  return [...new Set([...fromSectors, ...fromWatch])].filter((s) => s !== sym);
}

export default function CorrelationPanel({ ticker, onPick }: { ticker: string; onPick: (sym: string) => void }) {
  const peers = useMemo(() => candidatePeers(ticker), [ticker]);
  const [data, setData] = useState<CorrelationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (peers.length === 0) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setData(null);
    getCorrelation(ticker, peers, 5)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [ticker, peers]);

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="p-head" style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 13.5 }}>🔗 Saham yang Gerak Bareng</span>
        <InfoTip text={TIP} />
      </div>

      {loading && <div className="loading-bar" />}

      {data && !data.enough_data && (
        <p className="muted" style={{ fontSize: 12.5 }}>Belum cukup data untuk menghitung hubungan.</p>
      )}

      {data?.enough_data && (
        <div className="fund-list">
          <PeerGroup title="🟢 Biasanya searah" peers={data.same} onPick={onPick} empty="Tidak ada yang jelas searah." />
          <PeerGroup title="🔴 Biasanya berlawanan" peers={data.opposite} onPick={onPick} empty="Tidak ada yang jelas berlawanan." />
        </div>
      )}
    </div>
  );
}

function PeerGroup({ title, peers, onPick, empty }: { title: string; peers: CorrelationPeer[]; onPick: (s: string) => void; empty: string }) {
  return (
    <div className="pattern neutral">
      <div className="p-head"><span>{title}</span></div>
      {peers.length === 0 ? (
        <div className="p-sum">{empty}</div>
      ) : (
        <div className="p-sum" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {peers.map((p) => (
            <button key={p.sym} type="button" className="chip" title={`Buka ${p.sym} di grafik`} onClick={() => onPick(p.sym)}>
              {p.sym.replace(".JK", "")} · {p.strength}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
