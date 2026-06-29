// Balance Position chart: a stacked bar per month-end snapshot showing the
// Local vs Foreign ownership split, with the % Foreign drawn as a line on top.
// Plain SVG, no chart lib. Foreign is shown in warm tones, Local in cool tones.
import { useMemo } from "react";
import type { OwnershipComposition } from "../types";

const W = 560;
const H = 300;
const PAD_L = 40;
const PAD_B = 28;
const PAD_T = 12;
const PAD_R = 12;

const LOCAL_COLOR = "#8b5cf6";   // purple — local block
const FOREIGN_COLOR = "#0d9488"; // teal — foreign block
const LINE_COLOR = "#f59e0b";    // amber — % foreign line

function shortDate(d: string): string {
  // "29-MAY-2026" -> "Mei '26"
  const [, mon, year] = d.split("-");
  const map: Record<string, string> = {
    JAN: "Jan", FEB: "Feb", MAR: "Mar", APR: "Apr", MAY: "Mei", JUN: "Jun",
    JUL: "Jul", AUG: "Agu", SEP: "Sep", OCT: "Okt", NOV: "Nov", DEC: "Des",
  };
  return `${map[mon] ?? mon} '${year?.slice(2) ?? ""}`;
}

export default function BalancePositionChart({ series }: { series: OwnershipComposition[] }) {
  const { bars, linePts } = useMemo(() => {
    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const n = series.length;
    const slot = innerW / Math.max(n, 1);
    const bw = Math.min(34, slot * 0.7);

    const bars = series.map((s, i) => {
      const total = s.local_total + s.foreign_total || 1;
      const x = PAD_L + slot * i + (slot - bw) / 2;
      const localH = (s.local_total / total) * innerH;
      const foreignH = (s.foreign_total / total) * innerH;
      return {
        x, bw,
        // foreign stacked on top of local
        localY: PAD_T + innerH - localH,
        localH,
        foreignY: PAD_T + innerH - localH - foreignH,
        foreignH,
        label: shortDate(s.date),
      };
    });

    const linePts = series.map((s, i) => {
      const x = PAD_L + slot * i + slot / 2;
      const y = PAD_T + innerH - (s.pct_foreign / 100) * innerH;
      return `${x},${y}`;
    });

    return { bars, linePts: linePts.join(" ") };
  }, [series]);

  return (
    <svg className="bal-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Balance Position Chart">
      {/* y gridlines at 0/25/50/75/100% */}
      {[0, 25, 50, 75, 100].map((p) => {
        const y = PAD_T + (H - PAD_T - PAD_B) * (1 - p / 100);
        return (
          <g key={p}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={PAD_L - 6} y={y + 3} textAnchor="end" className="bal-axis">{p}%</text>
          </g>
        );
      })}

      {bars.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={b.localY} width={b.bw} height={b.localH} fill={LOCAL_COLOR} />
          <rect x={b.x} y={b.foreignY} width={b.bw} height={b.foreignH} fill={FOREIGN_COLOR} />
          {/* label every other bar to avoid crowding */}
          {i % 2 === 0 && (
            <text x={b.x + b.bw / 2} y={H - PAD_B + 16} textAnchor="middle" className="bal-axis">{b.label}</text>
          )}
        </g>
      ))}

      {/* % Foreign line */}
      <polyline points={linePts} fill="none" stroke={LINE_COLOR} strokeWidth="2" />
    </svg>
  );
}
