import clsx from "clsx";
import type { ReactNode } from "react";
import { AlertIcon, CheckIcon, ChevronDownIcon, InfoIcon } from "../../ui";
import { stabilityLabel, type StabilityState } from "./tiltPhysics";

/** Estado de la señal con icono + texto (nunca solo color). */
export function StatePill({ state, simulated = false }: { state: StabilityState; simulated?: boolean }) {
  if (simulated) {
    return <span className="state-pill is-moving"><AlertIcon size={15} />Simulación</span>;
  }
  const className = state === "stable" ? "is-stable" : state === "moving" ? "is-moving" : "is-insufficient";
  return (
    <span className={clsx("state-pill", className)}>
      {state === "stable" ? <CheckIcon size={15} /> : state === "moving" ? <span aria-hidden="true" className="text-[15px] leading-none">≈</span> : <AlertIcon size={15} />}
      {stabilityLabel(state)}
    </span>
  );
}

export type DataKind = "directa" | "derivada" | "parametro";

const KIND_LABEL: Record<DataKind, string> = {
  directa: "Medición entregada",
  derivada: "Magnitud derivada",
  parametro: "Parámetro de LabMotion",
};

export function KindTag({ kind }: { kind: DataKind }) {
  return (
    <span
      className={clsx(
        "inline-flex min-h-6 items-center rounded-full px-2.5 text-[11px] font-bold tracking-[0.02em]",
        kind === "directa" && "bg-accent-soft text-accent-text",
        kind === "derivada" && "bg-[color-mix(in_srgb,var(--axis-theta)_14%,white)] text-[#5b2bb5]",
        kind === "parametro" && "bg-surface-muted text-text-secondary",
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

export function Disclosure({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary>
        <span>{summary}</span>
        <ChevronDownIcon className="disclosure-chevron shrink-0" />
      </summary>
      <div className="pb-1">{children}</div>
    </details>
  );
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger"; title?: string; children: ReactNode }) {
  return (
    <div
      className={clsx(
        "flex items-start gap-3 rounded-[16px] px-3.5 py-3 text-caption",
        tone === "info" && "bg-accent-soft text-text-primary",
        tone === "warning" && "bg-warning-soft text-text-primary",
        tone === "danger" && "bg-danger-soft text-text-primary",
      )}
      role={tone === "danger" ? "alert" : undefined}
    >
      <span className={clsx("mt-0.5 shrink-0", tone === "info" ? "text-accent" : tone === "warning" ? "text-warning" : "text-danger")}>
        {tone === "info" ? <InfoIcon size={18} /> : <AlertIcon size={18} />}
      </span>
      <div className="min-w-0">
        {title && <p className="m-0 font-semibold">{title}</p>}
        <div className={clsx("text-text-secondary", title && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}

export function ProgressRing({ value, size = 44 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <svg className="progress-ring" width={size} height={size} viewBox="0 0 44 44" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)}>
      <circle className="track" cx="22" cy="22" r="19" pathLength="1" />
      <circle className="value" cx="22" cy="22" r="19" pathLength="1" style={{ strokeDashoffset: 1 - clamped }} />
    </svg>
  );
}
