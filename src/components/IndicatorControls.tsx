import type { IndicatorKind, IndicatorSpec } from "../types";
import { INDICATOR_KINDS, colorFor } from "../indicators";
import { INDICATOR_INFO } from "../help";
import { InfoTip } from "./ui";

// Pick indicators as friendly cards. Each card toggles one indicator kind on/off;
// when on, a small period control appears. Parent owns the active spec list.
export default function IndicatorControls({
  active,
  onAdd,
  onRemove,
}: {
  active: IndicatorSpec[];
  onAdd: (spec: IndicatorSpec) => void;
  onRemove: (spec: IndicatorSpec) => void;
}) {
  const activeOf = (kind: IndicatorKind) => active.find((s) => s.kind === kind);

  function toggle(kind: IndicatorKind) {
    const current = activeOf(kind);
    if (current) onRemove(current);
    else onAdd({ kind, period: INDICATOR_INFO[kind].defaultPeriod });
  }

  function setPeriod(kind: IndicatorKind, period: number) {
    if (!Number.isFinite(period) || period < 1) return;
    const current = activeOf(kind);
    if (current) onRemove(current);
    onAdd({ kind, period });
  }

  return (
    <div className="ind-grid">
      {INDICATOR_KINDS.map((kind) => {
        const info = INDICATOR_INFO[kind];
        const current = activeOf(kind);
        const isOn = Boolean(current);
        const period = current?.period ?? info.defaultPeriod;
        const swatch = colorFor(`${kind.toUpperCase()}_${period}`);
        return (
          <div
            key={kind}
            className={`ind-card${isOn ? " active" : ""}`}
            role="button"
            tabIndex={0}
            aria-pressed={isOn}
            onClick={() => toggle(kind)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggle(kind);
              }
            }}
          >
            <div className="top">
              <span className="name">
                <span className="swatch" style={{ background: isOn ? swatch : "var(--border-strong)" }} />
                {info.emoji} {info.label}
              </span>
              <span className="tick">{isOn ? "✓ aktif" : "+"}</span>
            </div>
            <div className="desc">{info.short}</div>

            {isOn && (
              <div
                className="row"
                style={{ marginTop: 10, alignItems: "center" }}
                // Don't let clicks on the period control toggle the card off.
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <label className="field" style={{ flex: "1 1 auto" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {info.periodLabel} <InfoTip text={info.tip} />
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={period}
                    onChange={(e) => setPeriod(kind, Number(e.target.value))}
                    aria-label={`Periode ${info.label}`}
                  />
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
