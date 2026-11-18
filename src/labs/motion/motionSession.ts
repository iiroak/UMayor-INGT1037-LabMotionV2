import { formatNumber, formatPercent } from "../../lib/format";
import { errorAbsoluto, errorPorcentual, estadisticas, type Stats } from "../tilt/tiltPhysics";
import { DEFAULT_MOTION_CONFIG, MOTION_CALC_VERSION, type MotionAnalysis, type MotionConfig, type MotionKind } from "./motionPhysics";

/** Repeticiones sugeridas por laboratorio. */
export const REPETITIONS_TARGET = 3;

/** Pruebas que se conservan por laboratorio; al superarlas se descartan las más antiguas. */
export const MAX_TRIALS = 12;

export type TrialQuality = "ok" | "advertencia";

export type MotionTrial = {
  id: string;
  kind: MotionKind;
  attempt: number;
  createdAt: string;
  quality: TrialQuality;
  analysis: MotionAnalysis;
  /** Distancia total medida con cinta o regla (m), si el estudiante la registró. */
  referenceM: number | null;
  screenOrientation: string;
  /** Umbrales usados: se exportan con cada prueba. */
  config: MotionConfig;
};

export type TrialInput = {
  kind: MotionKind;
  attempt: number;
  analysis: MotionAnalysis;
  referenceM?: number | null;
  screenOrientation: string;
  config?: MotionConfig;
  now?: Date;
  id?: string;
};

export function makeTrialId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `M${Date.now().toString(36)}-${random}`;
}

export function isValidDistance(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

export function buildTrial(input: TrialInput): MotionTrial {
  const referenceM = input.referenceM !== undefined && input.referenceM !== null && isValidDistance(input.referenceM) ? input.referenceM : null;
  return {
    id: input.id ?? makeTrialId(),
    kind: input.kind,
    attempt: input.attempt,
    createdAt: (input.now ?? new Date()).toISOString(),
    quality: input.analysis.warnings.length > 0 ? "advertencia" : "ok",
    analysis: input.analysis,
    referenceM,
    screenOrientation: input.screenOrientation,
    config: input.config ?? DEFAULT_MOTION_CONFIG,
  };
}

/** Distancia total estimada por la app en esta prueba (m). */
export function estimatedDistance(trial: MotionTrial): number | null {
  const { mru, mrua } = trial.analysis;
  return mru?.totalDistance ?? mrua?.totalDistance ?? null;
}

export type ReferenceComparison = { measured: number; reference: number; absolute: number; percent: number | null };

export function referenceComparison(trial: MotionTrial): ReferenceComparison | null {
  const measured = estimatedDistance(trial);
  if (measured === null || trial.referenceM === null) return null;
  return {
    measured,
    reference: trial.referenceM,
    absolute: errorAbsoluto(measured, trial.referenceM),
    percent: errorPorcentual(measured, trial.referenceM),
  };
}

export function nextAttempt(trials: readonly MotionTrial[]): number {
  return trials.reduce((max, trial) => Math.max(max, trial.attempt), 0) + 1;
}

export function guidedProgress(trials: readonly MotionTrial[]): { done: number; target: number } {
  return { done: Math.min(trials.length, REPETITIONS_TARGET), target: REPETITIONS_TARGET };
}

/** Agrega la prueba (o reemplaza `replaceId`) y respeta el máximo de pruebas. */
export function applyTrial(trials: readonly MotionTrial[], trial: MotionTrial, replaceId: string | null): MotionTrial[] {
  const without = replaceId ? trials.filter((item) => item.id !== replaceId) : [...trials];
  const next = [...without, trial].sort((a, b) => a.attempt - b.attempt);
  return next.length > MAX_TRIALS ? next.slice(next.length - MAX_TRIALS) : next;
}

// ── Resumen y conclusión ───────────────────────────────────────────────

export type MotionSummary = {
  kind: MotionKind;
  n: number;
  /** MRU: velocidad de crucero (m/s). MRUA: aceleración medida (m/s²). */
  primary: Stats | null;
  /** MRU: variación de la velocidad en el crucero (fracción). MRUA: coeficiente de roce estimado. */
  secondary: Stats | null;
  /** MRU: aceleración en el crucero. MRUA: g·senθ. */
  tertiary: Stats | null;
  /** R² del ajuste principal (x(t) en MRU, v(t) en MRUA). */
  r2: Stats | null;
  /** Error absoluto de la distancia total frente a la medida con cinta. */
  distanceError: Stats | null;
  withWarnings: number;
};

export function summarize(kind: MotionKind, trials: readonly MotionTrial[]): MotionSummary {
  const own = trials.filter((trial) => trial.kind === kind);
  const pick = (read: (trial: MotionTrial) => number | undefined) =>
    estadisticas(own.flatMap((trial) => {
      const value = read(trial);
      return value === undefined ? [] : [value];
    }));
  const distance = own.flatMap((trial) => {
    const comparison = referenceComparison(trial);
    return comparison ? [comparison.absolute] : [];
  });
  return {
    kind,
    n: own.length,
    primary: kind === "mru" ? pick((t) => t.analysis.mru?.vCruise) : pick((t) => t.analysis.mrua?.aMean),
    secondary: kind === "mru" ? pick((t) => t.analysis.mru?.vVariation) : pick((t) => t.analysis.mrua?.mu),
    tertiary: kind === "mru" ? pick((t) => t.analysis.mru?.aCruise) : pick((t) => t.analysis.mrua?.aIdeal),
    r2: kind === "mru" ? pick((t) => t.analysis.mru?.xFit.r2) : pick((t) => t.analysis.mrua?.vFit.r2),
    distanceError: estadisticas(distance),
    withWarnings: own.filter((trial) => trial.quality === "advertencia").length,
  };
}

function trialWord(n: number): string {
  return n === 1 ? "1 prueba" : `${n} pruebas`;
}

/** Variación relativa de la velocidad que aún se considera «casi constante». */
export const UNIFORM_VARIATION = 0.1;
/** Aceleración (m/s²) bajo la cual el crucero se considera «casi sin aceleración». */
export const UNIFORM_ACCEL = 0.2;

/**
 * Conclusión asistida. Solo usa los datos presentes; no afirma calibración ni
 * precisión demostrada.
 */
export function buildConclusion(kind: MotionKind, trials: readonly MotionTrial[]): string[] {
  const summary = summarize(kind, trials);
  if (summary.n === 0 || !summary.primary) {
    return ["Aún no hay mediciones registradas. Registra al menos una prueba para obtener resultados."];
  }
  const lines: string[] = [];
  const std = (stats: Stats | null, digits: number) => (stats && stats.std !== null ? `, dispersión entre pruebas ${formatNumber(stats.std, digits)}` : "");
  if (kind === "mru") {
    lines.push(`En ${trialWord(summary.n)}, la velocidad de crucero fue en promedio ${formatNumber(summary.primary.mean, 2)} m/s${std(summary.primary, 2)}.`);
    if (summary.secondary && summary.tertiary) {
      const variation = summary.secondary.mean;
      const accel = summary.tertiary.mean;
      lines.push(`Durante el crucero la velocidad varió en promedio ${formatPercent(variation * 100)} y la aceleración media fue ${formatNumber(accel, 2, true)} m/s².`);
      if (variation <= UNIFORM_VARIATION && Math.abs(accel) <= UNIFORM_ACCEL) {
        lines.push("Los datos son compatibles con un movimiento rectilíneo uniforme en ese tramo: la velocidad se mantuvo casi constante y la aceleración fue casi nula.");
      } else {
        lines.push("En ese tramo la velocidad no se mantuvo tan constante: probablemente el roce frenó el carrito o el sensor acumuló deriva. Prueba con una superficie más lisa.");
      }
    }
    if (summary.r2) lines.push(`La posición x(t) del crucero se ajusta a una recta con R² promedio ${formatNumber(summary.r2.mean, 3)}.`);
  } else {
    lines.push(`En ${trialWord(summary.n)}, la aceleración medida fue en promedio ${formatNumber(summary.primary.mean, 2)} m/s²${std(summary.primary, 2)}.`);
    if (summary.tertiary) {
      const ideal = summary.tertiary.mean;
      const diff = ideal > 0 ? ((summary.primary.mean - ideal) / ideal) * 100 : null;
      const side = diff === null ? "" : diff < 0 ? "por debajo" : "por encima";
      lines.push(`Con la inclinación medida por el propio teléfono, g·sen θ vale ${formatNumber(ideal, 2)} m/s²; la aceleración medida quedó ${diff === null ? "—" : `${formatPercent(Math.abs(diff))} ${side}`} de ese valor.`);
    }
    if (summary.secondary) {
      lines.push(`Si la diferencia se debe solo al roce, el coeficiente de roce cinético estimado es μ ≈ ${formatNumber(summary.secondary.mean, 2)}. Un valor negativo indicaría un problema de medición.`);
    }
    if (summary.r2) lines.push(`La velocidad v(t) se ajusta a una recta con R² promedio ${formatNumber(summary.r2.mean, 3)}: una recta con pendiente constante es la señal del movimiento uniformemente acelerado.`);
  }
  if (summary.distanceError) {
    lines.push(`La distancia estimada por la app difirió en promedio ${formatNumber(summary.distanceError.mean, 2)} m de la medida con cinta.`);
  }
  if (summary.withWarnings > 0) {
    lines.push(`${summary.withWarnings === 1 ? "1 prueba tiene" : `${summary.withWarnings} pruebas tienen`} avisos de calidad: revísalos antes de usar sus datos.`);
  }
  if (summary.n < REPETITIONS_TARGET) {
    lines.push(`Procedimiento incompleto: se sugieren ${REPETITIONS_TARGET} repeticiones y hay ${summary.n}. Con pocas pruebas no se puede juzgar la dispersión.`);
  }
  lines.push("Estas cifras salen de integrar el acelerómetro del teléfono: son estimaciones y no certifican la calibración del sensor.");
  return lines;
}

const KIND_TITLE: Record<MotionKind, string> = {
  mru: "Movimiento rectilíneo uniforme (MRU)",
  mrua: "Movimiento rectilíneo uniformemente acelerado (MRUA)",
};

export function kindTitle(kind: MotionKind): string {
  return KIND_TITLE[kind];
}

/** Resumen en texto plano para pegar en el informe. */
export function reportSummary(kind: MotionKind, trials: readonly MotionTrial[], context: { device: string; date?: Date }): string {
  const own = trials.filter((trial) => trial.kind === kind);
  const header = [
    `LabMotion — ${kindTitle(kind)}`,
    `Fecha: ${(context.date ?? new Date()).toLocaleString("es-CL")}`,
    `Dispositivo / navegador: ${context.device}`,
    `Versión del cálculo: ${MOTION_CALC_VERSION}`,
    kind === "mru"
      ? "Cálculo: a = lectura − línea base; v = ∫a·dt con velocidad final 0; x = ∫v·dt; ajuste lineal de x(t) en el crucero"
      : "Cálculo: a = lectura − línea base; v = ∫a·dt; x = ∫v·dt; θ = atan2(√(gx² + gy²), |gz|); a ideal = g·sen θ",
    "",
  ];
  const table = kind === "mru"
    ? [
        "Prueba | v crucero (m/s) | Variación v | a crucero (m/s²) | R² x(t) | Distancia (m) | Cinta (m)",
        ...own.map((trial) => {
          const r = trial.analysis.mru;
          return [
            `P${trial.attempt}`,
            formatNumber(r?.vCruise, 2),
            r ? formatPercent(r.vVariation * 100) : "—",
            formatNumber(r?.aCruise, 2, true),
            formatNumber(r?.xFit.r2, 3),
            formatNumber(r?.totalDistance, 2),
            trial.referenceM === null ? "—" : formatNumber(trial.referenceM, 2),
          ].join(" | ");
        }),
      ]
    : [
        "Prueba | θ (°) | a medida (m/s²) | g·sen θ (m/s²) | Diferencia | μ estimado | R² v(t) | Distancia (m) | Cinta (m)",
        ...own.map((trial) => {
          const r = trial.analysis.mrua;
          return [
            `P${trial.attempt}`,
            formatNumber(r?.thetaDeg, 1),
            formatNumber(r?.aMean, 2),
            formatNumber(r?.aIdeal, 2),
            r?.aDiffPercent === null || r === undefined ? "—" : formatPercent(r.aDiffPercent),
            formatNumber(r?.mu, 2),
            formatNumber(r?.vFit.r2, 3),
            formatNumber(r?.totalDistance, 2),
            trial.referenceM === null ? "—" : formatNumber(trial.referenceM, 2),
          ].join(" | ");
        }),
      ];
  return [...header, ...table, "", ...buildConclusion(kind, own)].join("\n");
}

// ── Persistencia local (solo este navegador) ────────────────────────────

const STORAGE_VERSION = 1;

export function storageKey(kind: MotionKind): string {
  return `labmotion.v2.${kind}.trials`;
}

type StoredTrials = { version: number; trials: readonly MotionTrial[] };

function isTrial(value: unknown, kind: MotionKind): value is MotionTrial {
  if (!value || typeof value !== "object") return false;
  const trial = value as Partial<MotionTrial>;
  const analysis = trial.analysis as Partial<MotionAnalysis> | undefined;
  return typeof trial.id === "string"
    && trial.kind === kind
    && typeof trial.attempt === "number"
    && !!analysis
    && Array.isArray(analysis.series)
    && (kind === "mru" ? !!analysis.mru : !!analysis.mrua);
}

export function loadTrials(kind: MotionKind, storage: Storage | null = safeStorage()): MotionTrial[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey(kind));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredTrials>;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.trials)) return [];
    return parsed.trials.filter((trial): trial is MotionTrial => isTrial(trial, kind));
  } catch {
    return [];
  }
}

/** Devuelve false si el navegador no permitió guardar (cuota o modo privado). */
export function saveTrials(kind: MotionKind, trials: readonly MotionTrial[], storage: Storage | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    if (trials.length === 0) storage.removeItem(storageKey(kind));
    else storage.setItem(storageKey(kind), JSON.stringify({ version: STORAGE_VERSION, trials } satisfies StoredTrials));
    return true;
  } catch {
    return false;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
