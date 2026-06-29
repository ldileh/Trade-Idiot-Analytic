// Relative Rotation Graph rendered as a plain SVG (no chart lib). Four quadrants
// split at x=100, y=100: Leading (top-right), Weakening (bottom-right),
// Lagging (bottom-left), Improving (top-left). Each symbol draws a fading tail
// ending in a labelled head dot, colored by its current quadrant.
import { useMemo } from "react";
import type { RRGResponse, RRGSymbol } from "../types";

const QUADRANT_COLOR: Record<RRGSymbol["quadrant"], string> = {
  leading: "#16a34a",
  weakening: "#eab308",
  lagging: "#dc2626",
  improving: "#3b82f6",
};

const W = 560;
const H = 460;
const PAD = 36;

export default function RRGChart({ data }: { data: RRGResponse }) {
  // Symmetric bounds around 100 so the center cross sits in the middle, with a
  // little margin past the most extreme point.
  const bounds = useMemo(() => {
    let max = 1.5;
    for (const s of data.symbols)
      for (const p of s.tail)
        max = Math.max(max, Math.abs(p.x - 100), Math.abs(p.y - 100));
    const m = max * 1.15;
    return { min: 100 - m, max: 100 + m };
  }, [data]);

  const sx = (x: number) =>
    PAD + ((x - bounds.min) / (bounds.max - bounds.min)) * (W - 2 * PAD);
  // SVG y grows downward; higher RS-Momentum should be higher on screen.
  const sy = (y: number) =>
    H - PAD - ((y - bounds.min) / (bounds.max - bounds.min)) * (H - 2 * PAD);

  const cx = sx(100);
  const cy = sy(100);

  return (
    <svg className="rrg-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Relative Rotation Graph">
      {/* Quadrant backgrounds */}
      <rect x={cx} y={PAD} width={W - PAD - cx} height={cy - PAD} fill="#16a34a" opacity="0.07" />
      <rect x={cx} y={cy} width={W - PAD - cx} height={H - PAD - cy} fill="#eab308" opacity="0.07" />
      <rect x={PAD} y={cy} width={cx - PAD} height={H - PAD - cy} fill="#dc2626" opacity="0.07" />
      <rect x={PAD} y={PAD} width={cx - PAD} height={cy - PAD} fill="#3b82f6" opacity="0.07" />

      {/* Center cross */}
      <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="var(--border-strong)" strokeWidth="1" />
      <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="var(--border-strong)" strokeWidth="1" />

      {/* Quadrant labels */}
      <text x={W - PAD - 4} y={PAD + 14} textAnchor="end" className="rrg-q good">Leading</text>
      <text x={W - PAD - 4} y={H - PAD - 6} textAnchor="end" className="rrg-q warn">Weakening</text>
      <text x={PAD + 4} y={H - PAD - 6} className="rrg-q bad">Lagging</text>
      <text x={PAD + 4} y={PAD + 14} className="rrg-q info">Improving</text>

      {/* Axis hints */}
      <text x={W / 2} y={H - 8} textAnchor="middle" className="rrg-axis">Kekuatan Relatif (RS-Ratio) →</text>
      <text x={12} y={H / 2} textAnchor="middle" className="rrg-axis" transform={`rotate(-90 12 ${H / 2})`}>Momentum Relatif →</text>

      {/* One path per symbol */}
      {data.symbols.map((s) => {
        const color = QUADRANT_COLOR[s.quadrant];
        const pts = s.tail.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
        const head = pts[pts.length - 1];
        const line = pts.map((p) => `${p.x},${p.y}`).join(" ");
        return (
          <g key={s.symbol}>
            <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" opacity="0.55" />
            {pts.slice(0, -1).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2" fill={color} opacity={0.25 + (0.5 * i) / pts.length} />
            ))}
            <circle cx={head.x} cy={head.y} r="5" fill={color} stroke="#fff" strokeWidth="1.5" />
            <text x={head.x + 8} y={head.y + 4} className="rrg-label" fill={color}>
              {s.symbol.replace(".JK", "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
