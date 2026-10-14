import { useEffect, useId } from "react";
import clsx from "clsx";
import { useBackLayer } from "./back-stack";

/**
 * Hoja inferior de Fit-App: div fixed inset-0 siempre montado, transición
 * opacity+translateY, cierre por click en overlay, Escape o el botón "atrás"
 * del sistema. El panel scrollea por dentro si el contenido supera el 88 % del
 * alto visible (teléfonos pequeños en vertical).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const titleId = useId();
  useBackLayer(open, onClose);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={clsx(
        "fixed inset-0 z-40 flex items-end justify-center transition-opacity duration-[var(--duration-base)] ease-[var(--ease-out)]",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="absolute inset-0 bg-overlay" onClick={onClose} />
      <div
        className={clsx(
          "relative max-h-[88dvh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-t-2xl bg-surface px-[18px] pt-3 pb-[calc(26px+env(safe-area-inset-bottom))] shadow-sheet transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)]",
          open ? "translate-y-0" : "translate-y-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
      >
        <div className="mx-auto mb-4 h-1 w-[30px] rounded-full bg-border-soft" />
        {title && <h2 id={titleId} className="mb-3 text-title-lg font-bold text-text-primary">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
