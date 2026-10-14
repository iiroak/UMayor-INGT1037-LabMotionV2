import { formatDeg } from "../../lib/format";
import type { ReferenceSummary } from "./tiltSession";

const W = 320;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 54, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const MAX = 90;

const sx = (deg: number) => PAD.left + (Math.max(0, Math.min(MAX, deg)) / MAX) * PLOT_W;
const sy = (deg: number) => PAD.top + PLOT_H - (Math.max(0, Math.min(MAX, deg)) / MAX) * PLOT_H;

/**
 * Referencia del transportador físico (X) contra lo medido por LabMotion (Y).
 * La diagonal punteada es "medida = referencia"; la distancia vertical de cada
 * punto a la diagonal es el error de esa prueba.
 */
export function TiltComparisonChart({ summaries }: { summaries: ReferenceSummary[] }) {
  const ticks = [0, 15, 30, 45, 60, 75, 90];
  const description = summaries
    .map((summary) => `referencia ${formatDeg(summary.referenceDeg, 0)}: promedio ${formatDeg(summary.meanDeg)} con ${summary.n} prueba${summary.n === 1 ? "" : "s"}`)
    .join("; ");
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[460px]" role="img" aria-label={`Comparación entre referencia y medida. ${description || "Sin pruebas."}`}>
        <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} rx="10" fill="var(--surface-soft)" />
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={sx(tick)} y1={PAD.top} x2={sx(tick)} y2={PAD.top + PLOT_H} stroke="var(--border-soft)" />
            <line x1={PAD.left} y1={sy(tick)} x2={PAD.left + PLOT_W} y2={sy(tick)} stroke="var(--border-soft)" />
            <text x={sx(tick)} y={PAD.top + PLOT_H + 16} textAnchor="middle" fontSize="11" fill="var(--text-tertiary)">{tick}°</text>
            <text x={PAD.left - 6} y={sy(tick) + 4} textAnchor="end" fontSize="11" fill="var(--text-tertiary)">{tick}°</text>
          </g>
        ))}
        <line x1={sx(0)} y1={sy(0)} x2={sx(90)} y2={sy(90)} stroke="var(--text-secondary)" strokeWidth="1.5" strokeDasharray="5 5" />
        <text x={sx(47)} y={sy(47) - 7} fontSize="10.5" fill="var(--text-secondary)" transform={`rotate(-${(Math.atan2(PLOT_H, PLOT_W) * 180) / Math.PI} ${sx(47)} ${sy(47) - 7})`}>medida = referencia</text>
        {summaries.flatMap((summary) => summary.trials.map((trial) => (
          <circle key={trial.id} cx={sx(trial.referenceDeg)} cy={sy(trial.meanDeg)} r="4.5" fill="none" stroke="var(--accent)" strokeWidth="2" />
        )))}
        {summaries.map((summary) => (
          <g key={summary.referenceDeg}>
            <rect x={sx(summary.referenceDeg) - 6} y={sy(summary.meanDeg) - 6} width="12" height="12" transform={`rotate(45 ${sx(summary.referenceDeg)} ${sy(summary.meanDeg)})`} fill="var(--fab)" />
          </g>
        ))}
        <text x={PAD.left + PLOT_W / 2} y={H - 18} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-secondary)">Referencia del transportador físico (°)</text>
        <text transform={`translate(14 ${PAD.top + PLOT_H / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--text-secondary)">Medida por LabMotion (°)</text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-micro text-text-secondary">
        <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="var(--accent)" strokeWidth="2" /></svg>Cada prueba</span>
        <span className="inline-flex items-center gap-1.5"><svg width="12" height="12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" fill="var(--fab)" /></svg>Promedio por referencia</span>
        <span className="inline-flex items-center gap-1.5"><svg width="18" height="12" aria-hidden="true"><line x1="0" y1="6" x2="18" y2="6" stroke="var(--text-secondary)" strokeDasharray="4 3" strokeWidth="1.5" /></svg>Coincidencia perfecta</span>
      </figcaption>
    </figure>
  );
}
