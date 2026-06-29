// "Analisa Momentum Relatif" panel: pick a sector and timeframe, then plot its
// members on a Relative Rotation Graph vs the sector benchmark. Loads when the
// drawer opens (and on sector/timeframe change). Click a symbol to open it on
// the main chart.
import { useEffect, useState } from "react";
import { getRRG } from "../api/client";
import { SECTORS } from "../sectors";
import type { Interval, RRGResponse, RRGQuadrant } from "../types";
import RRGChart from "./RRGChart";

const QUADRANT_LABEL: Record<RRGQuadrant, string> = {
  leading: "🟢 Leading (kuat & menguat)",
  weakening: "🟡 Weakening (kuat tapi melemah)",
  lagging: "🔴 Lagging (lemah & melemah)",
  improving: "🔵 Improving (lemah tapi membaik)",
};

export default function RRGPanel({
  open,
  onPick,
}: {
  open: boolean;
  onPick: (sym: string) => void;
}) {
  const [sectorKey, setSectorKey] = useState(SECTORS[0].key);
  const [timeframe, setTimeframe] = useState<Interval>("1wk");
  const [data, setData] = useState<RRGResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sector = SECTORS.find((s) => s.key === sectorKey) ?? SECTORS[0];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    // Weekly wants a longer window than daily to have enough bars to normalize.
    const range = timeframe === "1wk" ? "2y" : "6mo";
    getRRG(sector.symbols, sector.benchmark, timeframe, range, 8)
      .then((r) => !cancelled && setData(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, sectorKey, timeframe, sector.symbols, sector.benchmark]);

  return (
    <div>
      <div className="rrg-controls">
        <select value={sectorKey} onChange={(e) => setSectorKey(e.target.value)} aria-label="Pilih sektor">
          {SECTORS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <div className="rrg-tf">
          <button type="button" className={timeframe === "1d" ? "active" : ""} onClick={() => setTimeframe("1d")}>Daily</button>
          <button type="button" className={timeframe === "1wk" ? "active" : ""} onClick={() => setTimeframe("1wk")}>Weekly</button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Benchmark: <b>{sector.benchmark}</b>. Ekor menunjukkan arah rotasi beberapa periode terakhir.
      </p>

      {loading && <div className="loading-bar" />}
      {error && <div className="alert" role="alert">{error}</div>}

      {data && data.symbols.length > 0 && (
        <>
          <RRGChart data={data} />
          <div className="rrg-legend">
            {(Object.keys(QUADRANT_LABEL) as RRGQuadrant[]).map((q) => {
              const syms = data.symbols.filter((s) => s.quadrant === q);
              if (syms.length === 0) return null;
              return (
                <div key={q} className="rrg-leg-row">
                  <span className="rrg-leg-title">{QUADRANT_LABEL[q]}</span>
                  <span className="rrg-leg-syms">
                    {syms.map((s) => (
                      <button key={s.symbol} type="button" className="chip" onClick={() => onPick(s.symbol)} title="Buka di grafik">
                        {s.symbol.replace(".JK", "")}
                      </button>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
