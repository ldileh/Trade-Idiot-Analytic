// Peta Pasar — treemap: ukuran kotak = market cap, warna = perubahan harga hari
// ini (hijau naik, merah turun). Sumber: daftar favorit user atau satu sektor
// IDX. Klik kotak untuk membuka simbol itu di grafik utama. Layout squarified
// ditulis tangan (tanpa library chart), dirender dengan div CSS berposisi absolut.
import { useEffect, useMemo, useState } from "react";
import { getMarketMap } from "../api/client";
import { loadFavorites } from "../favorites";
import { isIDX } from "../format";
import { SECTORS } from "../sectors";
import type { MarketMapTile } from "../types";

// Squarified treemap: turn weighted items into rects filling [0,0,w,h].
// Classic Bruls/Huizing/van Wijk algorithm, minimal implementation.
interface Rect { sym: string; x: number; y: number; w: number; h: number; tile: MarketMapTile; }

function squarify(items: { weight: number; tile: MarketMapTile }[], W: number, H: number): Rect[] {
  const total = items.reduce((s, i) => s + i.weight, 0) || 1;
  const scaled = items.map((i) => ({ ...i, area: (i.weight / total) * W * H }));
  const out: Rect[] = [];
  let x = 0, y = 0, w = W, h = H;
  let row: typeof scaled = [];
  const worst = (r: typeof scaled, side: number) => {
    const s = r.reduce((a, b) => a + b.area, 0);
    const mx = Math.max(...r.map((b) => b.area));
    const mn = Math.min(...r.map((b) => b.area));
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  const layout = (r: typeof scaled) => {
    const side = Math.min(w, h);
    const s = r.reduce((a, b) => a + b.area, 0);
    const thick = s / side;
    let off = 0;
    for (const b of r) {
      const len = b.area / thick;
      if (w >= h) out.push({ sym: b.tile.sym, x, y: y + off, w: thick, h: len, tile: b.tile });
      else out.push({ sym: b.tile.sym, x: x + off, y, w: len, h: thick, tile: b.tile });
      off += len;
    }
    if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
  };
  for (const item of scaled) {
    const side = Math.min(w, h);
    if (row.length === 0 || worst([...row, item], side) <= worst(row, side)) {
      row.push(item);
    } else {
      layout(row);
      row = [item];
    }
  }
  if (row.length) layout(row);
  return out;
}

// Perubahan -> warna gradasi merah→hijau. 0 = abu-abu netral.
function color(pct: number | null): string {
  if (pct == null) return "var(--surface-2)";
  const c = Math.max(-4, Math.min(4, pct)) / 4; // clamp ±4% for saturation
  return c >= 0 ? `rgba(22,163,74,${0.25 + c * 0.6})` : `rgba(220,38,38,${0.25 + -c * 0.6})`;
}

export default function MarketMapPanel({ ticker, onPick }: { ticker: string; onPick: (sym: string) => void }) {
  const market = isIDX(ticker) ? "id" : "us";
  const idxSectors = useMemo(() => SECTORS.filter((s) => s.market === "id"), []);
  const favs = useMemo(() => loadFavorites()[market], [market]);

  // Source: favorites of the current market, or a chosen IDX sector.
  const [source, setSource] = useState<string>("fav");
  const symbols = useMemo(() => {
    if (source === "fav") return favs;
    return idxSectors.find((s) => s.key === source)?.symbols ?? [];
  }, [source, favs, idxSectors]);

  const [tiles, setTiles] = useState<MarketMapTile[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (symbols.length === 0) { setTiles([]); return; }
    let cancelled = false;
    setLoading(true);
    setTiles(null);
    getMarketMap(symbols)
      .then((r) => !cancelled && setTiles(r.tiles))
      .catch(() => !cancelled && setTiles([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [symbols]);

  const W = 100, H = 62; // treemap aspect (percent units); container sets real px.
  const rects = useMemo(() => {
    if (!tiles || tiles.length === 0) return [];
    // Fallback weight 1 for unknown market cap so it still gets a (small) box.
    const items = tiles.map((t) => ({ weight: Math.max(t.market_cap ?? 1, 1), tile: t }));
    return squarify(items, W, H);
  }, [tiles]);

  return (
    <div>
      <div className="rrg-controls" style={{ marginBottom: 8 }}>
        <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Pilih sumber Peta Pasar">
          <option value="fav">⭐ Favorit ({market.toUpperCase()}) — {favs.length} saham</option>
          {idxSectors.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </div>
      <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Kotak besar = perusahaan besar (market cap), 🟩 hijau = naik, 🟥 merah = turun hari ini. Klik kotak untuk buka di grafik.
      </p>

      {loading && <div className="loading-bar" />}
      {tiles && tiles.length === 0 && !loading && (
        <p className="muted" style={{ fontSize: 13 }}>
          {source === "fav" ? "Belum ada favorit. Tambahkan saham ke favorit (⭐) dulu." : "Belum cukup data untuk sektor ini."}
        </p>
      )}

      {rects.length > 0 && (
        <div style={{ position: "relative", width: "100%", aspectRatio: `${W} / ${H}`, borderRadius: 8, overflow: "hidden" }}>
          {rects.map((r) => (
            <button
              key={r.sym}
              type="button"
              onClick={() => onPick(r.sym)}
              title={`${r.sym} — ${r.tile.change_pct == null ? "?" : (r.tile.change_pct > 0 ? "+" : "") + r.tile.change_pct + "%"}`}
              style={{
                position: "absolute",
                left: `${r.x}%`, top: `${(r.y / H) * 100}%`,
                width: `${r.w}%`, height: `${(r.h / H) * 100}%`,
                background: color(r.tile.change_pct),
                border: "1px solid var(--bg)", color: "var(--text)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, cursor: "pointer", overflow: "hidden", padding: 2,
              }}
            >
              <span>{r.sym.replace(".JK", "")}</span>
              {r.tile.change_pct != null && (
                <span style={{ fontSize: 10, fontWeight: 600 }}>
                  {r.tile.change_pct > 0 ? "+" : ""}{r.tile.change_pct}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
