/**
 * Set de iconos outline con el mismo patrón que Fit-App: stroke 1.8 por
 * defecto, viewBox 24x24, fill="none", esquinas redondeadas. SVG inline, sin
 * librería externa. Los iconos son decorativos (`aria-hidden`): el texto que
 * los acompaña lleva el significado.
 */

type IconProps = { size?: number; strokeWidth?: number; className?: string };

const BASE_PROPS = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

/** Matraz: Laboratorios. */
export function FlaskIcon({ size = 22, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M9.5 3.5h5M10 3.5v5.2L4.9 17.6A2 2 0 0 0 6.6 20.5h10.8a2 2 0 0 0 1.7-2.9L14 8.7V3.5" />
      <path d="M7.4 14h9.2" />
    </svg>
  );
}

/** Sigma: magnitudes medidas y derivadas. */
export function SigmaIcon({ size = 22, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M17.5 5.5V4.5h-11l6 7.5-6 7.5h11v-1" />
    </svg>
  );
}

/** Punto de grabación: Capturar. */
export function RecordIcon({ size = 22, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Línea de señal: Gráficos. */
export function ChartIcon({ size = 22, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M3.5 4v15.5H20" />
      <path d="m7 14 3.2-4.2 3 2.6L19 6" />
    </svg>
  );
}

/** Escudo con check: Diagnóstico. */
export function ShieldCheckIcon({ size = 22, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M12 3.5 5 6v5.6c0 4.2 2.9 7.5 7 8.9 4.1-1.4 7-4.7 7-8.9V6Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  );
}

/** Transportador: experimento de inclinación. */
export function ProtractorIcon({ size = 22, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M3.5 18.5h17" />
      <path d="M3.5 18.5a8.5 8.5 0 0 1 17 0" />
      <path d="M12 18.5 17 11" />
      <path d="M12 10v1.6M6 12.5l1.1 1.1M18 12.5l-1.1 1.1" />
    </svg>
  );
}

/** Glifo del instrumento (marca LabMotion). */
export function SensorIcon({ size = 22, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 24, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 18, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 18, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function ArrowDownIcon({ size = 18, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />
    </svg>
  );
}

export function XIcon({ size = 20, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function CheckIcon({ size = 20, strokeWidth = 2.2, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

export function InfoIcon({ size = 18, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function AlertIcon({ size = 18, strokeWidth = 1.9, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M12 4 2.8 19.5h18.4Z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </svg>
  );
}

export function TrashIcon({ size = 18, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </svg>
  );
}

export function CopyIcon({ size = 18, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

export function DownloadIcon({ size = 18, strokeWidth = 1.9, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M12 4v11M7 10.5l5 5 5-5" />
      <path d="M4.5 19.5h15" />
    </svg>
  );
}

/** Copo: congelar la lectura. */
export function FreezeIcon({ size = 18, strokeWidth = 1.9, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" />
      <path d="m9.5 4.5 2.5 2 2.5-2M9.5 19.5l2.5-2 2.5 2" />
    </svg>
  );
}

export function PlayIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M8 5.6v12.8a1 1 0 0 0 1.52.85l10.2-6.4a1 1 0 0 0 0-1.7L9.52 4.75A1 1 0 0 0 8 5.6Z" />
    </svg>
  );
}

export function StopIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

export function RestartIcon({ size = 18, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="M4 12a8 8 0 1 0 2.35-5.65" />
      <path d="M4 4v4.5h4.5" />
    </svg>
  );
}

export function CodeIcon({ size = 18, strokeWidth = 1.9, className }: IconProps) {
  return (
    <svg {...BASE_PROPS(size, strokeWidth)} className={className}>
      <path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 5l-3 14" />
    </svg>
  );
}

export function GithubIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.5.1.65-.2.65-.46v-1.7c-2.65.58-3.2-1.13-3.2-1.13-.43-1.1-1.06-1.4-1.06-1.4-.87-.59.06-.58.06-.58.96.07 1.46.98 1.46.98.85 1.46 2.24 1.04 2.78.8.09-.62.33-1.04.6-1.28-2.11-.24-4.33-1.06-4.33-4.7 0-1.04.37-1.89.98-2.55-.1-.24-.42-1.21.09-2.53 0 0 .8-.26 2.62.97a9.1 9.1 0 0 1 4.77 0c1.82-1.23 2.62-.97 2.62-.97.52 1.32.19 2.29.1 2.53.6.66.98 1.51.98 2.55 0 3.65-2.23 4.46-4.35 4.7.34.29.65.87.65 1.76v2.6c0 .26.17.57.66.47A9.5 9.5 0 0 0 12 2.5Z" />
    </svg>
  );
}
