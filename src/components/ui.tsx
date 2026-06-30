// Small presentational building blocks shared across the app: a hover/focus
// tooltip for plain-language help, a card wrapper, a numbered step header, and
// a centered popup (modal) used for the indicator and backtest panels.
import { useEffect, useRef, useState, type ReactNode } from "react";

// A "?" dot that reveals a plain explanation on hover or keyboard focus.
// The bubble is positioned with `fixed` (computed from the dot's screen rect)
// so it's never clipped by the scrolling side panel's `overflow` and always
// sits above other content. It opens below the dot, or above if there's no room.
export function InfoTip({ text }: { text: string }) {
  const dotRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  function show() {
    const r = dotRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.bottom + 120 < window.innerHeight; // enough room under the dot?
    // Keep the bubble within the viewport's right edge (max bubble width ~280).
    const left = Math.min(r.left, window.innerWidth - 292);
    setPos({ left, top: below ? r.bottom + 8 : r.top - 8, below });
  }
  const hide = () => setPos(null);

  return (
    <span className="tip" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={dotRef}
        type="button"
        className="tip-dot"
        aria-label="Penjelasan"
        tabIndex={0}
        onFocus={show}
        onBlur={hide}
      >
        ?
      </button>
      {pos && (
        <span
          role="tooltip"
          className={`tip-body ${pos.below ? "below" : "above"}`}
          style={{ left: pos.left, top: pos.top }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={`card${className ? ` ${className}` : ""}`}>{children}</section>;
}

// Popup that closes on backdrop click or Escape; renders nothing when shut.
// `variant="drawer"` slides in from the right with a see-through backdrop, so the
// chart behind stays visible (used for the live indicator picker); the default
// "center" is a dimmed centered dialog (used for the backtest).
export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  variant = "center",
}: {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  variant?: "center" | "drawer";
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={`modal-backdrop ${variant}`} onClick={onClose}>
      <div className={`modal ${variant}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="modal-sub">{subtitle}</p>}
          </div>
          <button type="button" className="modal-x" aria-label="Tutup" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// Numbered "Langkah N" header with an optional subtitle line.
export function SectionHead({
  step,
  title,
  subtitle,
}: {
  step: number | string;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <>
      <div className="section-head">
        <span className="step-badge">{step}</span>
        <h2>{title}</h2>
      </div>
      {subtitle && <p className="section-sub">{subtitle}</p>}
    </>
  );
}
