import { frecuenciaDeMuestreo } from "../../lib/fisica";
import { formatDeg, formatNumber, formatPercent } from "../../lib/format";
import type { MotionSample } from "../../lib/sensors";
import {
  DEFAULT_TILT_CONFIG,
  TILT_CALC_VERSION,
  errorAbsoluto,
  errorPorcentual,
  estadisticas,
  type GravityMode,
  type TiltConfig,
  type TiltReading,
} from "./tiltPhysics";

/** Ángulos de referencia del procedimiento guiado. */
export const REFERENCE_PRESETS = [0, 30, 45, 60] as const;
/** Repeticiones sugeridas por referencia (12 pruebas en total). */
export const REPETITIONS_TARGET = 3;

export type TrialQuality = "ok" | "advertencia";

export type TiltTrial = {
  id: string;
  createdAt: string;
  calcVersion: string;
  /** Ángulo del transportador físico, ingresado por el usuario. */
  referenceDeg: number;
  /** Número de prueba dentro de la misma referencia (1, 2, 3…). */
  attempt: number;
  durationMs: number;
  validSamples: number;
  totalSamples: number;
  frequencyHz: number | null;
  meanDeg: number;
  stdDeg: number | null;
  minDeg: number;
  maxDeg: number;
  rangeDeg: number;
  absErrorDeg: number;
  /** null cuando la referencia es 0° (no aplica). */
  percentError: number | null;
  mode: GravityMode | "mixto";
  meanGravity: number;
  quality: TrialQuality;
  warnings: string[];
  screenOrientation: string;
  waitMs: number;
  restarts: number;
  config: TiltConfig;
  /** Muestras originales de la ventana promediada (tMs del navegador). */
  samples: MotionSample[];
  /** Ángulo calculado por muestra válida, alineado con `samples` por tMs. */
  angles: { tMs: number; thetaDeg: number }[];
};

export type TrialInput = {
  referenceDeg: number;
  attempt: number;
  samples: readonly MotionSample[];
  readings: readonly TiltReading[];
  waitMs: number;
  restarts: number;
  screenOrientation: string;
  config?: TiltConfig;
  now?: Date;
  id?: string;
};

export type TrialBuildResult = { ok: true; trial: TiltTrial } | { ok: false; reason: string };

export function makeTrialId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `T${Date.now().toString(36)}-${random}`;
}

export function isValidReference(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 90;
}

/**
 * Construye una prueba a partir de la ventana estable capturada. No inventa
 * valores: si faltan lecturas válidas, la prueba se rechaza.
 */
export function buildTrial(input: TrialInput): TrialBuildResult {
  const config = input.config ?? DEFAULT_TILT_CONFIG;
  if (!isValidReference(input.referenceDeg)) {
    return { ok: false, reason: "La referencia debe estar entre 0° y 90°." };
  }
  const readings = input.readings;
  if (readings.length < config.minSamplesInWindow) {
    return { ok: false, reason: `Solo llegaron ${readings.length} lecturas válidas; se necesitan al menos ${config.minSamplesInWindow}.` };
  }
  const stats = estadisticas(readings.map((reading) => reading.thetaDeg));
  if (!stats) return { ok: false, reason: "No hay lecturas válidas para promediar." };

  const times = readings.map((reading) => reading.tMs);
  const durationMs = times[times.length - 1] - times[0];
  const frequencyHz = frecuenciaDeMuestreo(times);
  const modes = new Set(readings.map((reading) => reading.mode));
  const mode: TiltTrial["mode"] = modes.size === 1 ? [...modes][0] : "mixto";
  const meanGravity = readings.reduce((sum, reading) => sum + reading.gravityMagnitude, 0) / readings.length;

  const warnings: string[] = [];
  if (mode !== "diferencia") {
    warnings.push("Gravedad estimada en reposo: el navegador no entregó aceleración lineal en todas las muestras.");
  }
  if (input.samples.length > readings.length) {
    warnings.push(`${input.samples.length - readings.length} muestras sin lectura válida se descartaron.`);
  }
  if (frequencyHz !== null && frequencyHz < 20) {
    warnings.push(`Frecuencia efectiva baja (${frequencyHz.toFixed(1)} Hz).`);
  }
  if (stats.std !== null && stats.std > config.maxStdDeg * 0.75) {
    warnings.push(`Dispersión cercana al umbral de estabilidad (σ = ${stats.std.toFixed(2)}°).`);
  }
  if (input.restarts > 0) {
    warnings.push(`La ventana se reinició ${input.restarts} ${input.restarts === 1 ? "vez" : "veces"} por movimiento.`);
  }

  const absErrorDeg = errorAbsoluto(stats.mean, input.referenceDeg);
  const trial: TiltTrial = {
    id: input.id ?? makeTrialId(),
    createdAt: (input.now ?? new Date()).toISOString(),
    calcVersion: TILT_CALC_VERSION,
    referenceDeg: input.referenceDeg,
    attempt: input.attempt,
    durationMs,
    validSamples: readings.length,
    totalSamples: input.samples.length,
    frequencyHz,
    meanDeg: stats.mean,
    stdDeg: stats.std,
    minDeg: stats.min,
    maxDeg: stats.max,
    rangeDeg: stats.range,
    absErrorDeg,
    percentError: errorPorcentual(stats.mean, input.referenceDeg),
    mode,
    meanGravity,
    quality: warnings.length > 0 ? "advertencia" : "ok",
    warnings,
    screenOrientation: input.screenOrientation,
    waitMs: input.waitMs,
    restarts: input.restarts,
    config,
    samples: input.samples.map((sample) => ({ ...sample })),
    angles: readings.map((reading) => ({ tMs: reading.tMs, thetaDeg: reading.thetaDeg })),
  };
  return { ok: true, trial };
}

/** Próximo número de prueba libre para una referencia (rellena huecos tras borrar). */
export function nextAttempt(trials: readonly TiltTrial[], referenceDeg: number): number {
  const used = new Set(trials.filter((trial) => trial.referenceDeg === referenceDeg).map((trial) => trial.attempt));
  let attempt = 1;
  while (used.has(attempt)) attempt += 1;
  return attempt;
}

/** Avance del procedimiento guiado: pruebas hechas (hasta 3 por referencia) sobre 12. */
export function guidedProgress(trials: readonly TiltTrial[]): { done: number; target: number } {
  const done = REFERENCE_PRESETS.reduce<number>(
    (total, reference) => total + Math.min(REPETITIONS_TARGET, trials.filter((trial) => trial.referenceDeg === reference).length),
    0,
  );
  return { done, target: REFERENCE_PRESETS.length * REPETITIONS_TARGET };
}

export type ReferenceSummary = {
  referenceDeg: number;
  trials: TiltTrial[];
  n: number;
  /** Promedio de los promedios de cada prueba. */
  meanDeg: number;
  /** Desviación estándar entre pruebas (null con una sola). */
  stdDeg: number | null;
  absErrorDeg: number;
  percentError: number | null;
};

export function summarizeByReference(trials: readonly TiltTrial[]): ReferenceSummary[] {
  const groups = new Map<number, TiltTrial[]>();
  for (const trial of trials) {
    const list = groups.get(trial.referenceDeg) ?? [];
    list.push(trial);
    groups.set(trial.referenceDeg, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([referenceDeg, list]) => {
      const sorted = [...list].sort((a, b) => a.attempt - b.attempt);
      const stats = estadisticas(sorted.map((trial) => trial.meanDeg));
      const meanDeg = stats?.mean ?? NaN;
      return {
        referenceDeg,
        trials: sorted,
        n: sorted.length,
        meanDeg,
        stdDeg: stats?.std ?? null,
        absErrorDeg: errorAbsoluto(meanDeg, referenceDeg),
        percentError: errorPorcentual(meanDeg, referenceDeg),
      };
    });
}

function trialWord(n: number): string {
  return n === 1 ? "1 prueba" : `${n} pruebas`;
}

/**
 * Conclusión asistida. Solo usa los datos presentes; no afirma calibración ni
 * precisión demostrada.
 */
export function buildConclusion(trials: readonly TiltTrial[]): string[] {
  if (trials.length === 0) return ["Aún no hay mediciones registradas. Registra al menos una prueba para obtener resultados."];
  const summaries = summarizeByReference(trials);
  const lines = summaries.map((summary) => {
    const measured = summary.n === 1
      ? `se midió ${formatDeg(summary.meanDeg)}`
      : `se midió en promedio ${formatDeg(summary.meanDeg)} (${trialWord(summary.n)}${summary.stdDeg !== null ? `, dispersión entre pruebas ${formatDeg(summary.stdDeg, 2)}` : ""})`;
    const percent = summary.percentError === null ? "" : ` (${formatPercent(summary.percentError)})`;
    return `Para una referencia de ${formatDeg(summary.referenceDeg, summary.referenceDeg % 1 === 0 ? 0 : 1)}, ${measured}; la diferencia fue ${formatDeg(summary.absErrorDeg)}${percent}.`;
  });
  if (summaries.length > 1) {
    const worst = summaries.reduce((a, b) => (b.absErrorDeg > a.absErrorDeg ? b : a));
    const best = summaries.reduce((a, b) => (b.absErrorDeg < a.absErrorDeg ? b : a));
    lines.push(
      `La menor diferencia promedio fue ${formatDeg(best.absErrorDeg)} (referencia ${formatDeg(best.referenceDeg, 0)}) y la mayor ${formatDeg(worst.absErrorDeg)} (referencia ${formatDeg(worst.referenceDeg, 0)}).`,
    );
  }
  const missing = REFERENCE_PRESETS.filter((reference) => {
    const summary = summaries.find((item) => item.referenceDeg === reference);
    return !summary || summary.n < REPETITIONS_TARGET;
  });
  if (missing.length > 0) {
    lines.push(
      `Procedimiento incompleto: faltan repeticiones para ${missing.map((reference) => `${reference}°`).join(", ")} (se sugieren ${REPETITIONS_TARGET} por referencia). Los resultados describen solo las pruebas realizadas.`,
    );
  }
  lines.push("Estas cifras comparan LabMotion con el transportador físico usado; no certifican la calibración del sensor.");
  return lines;
}

/** Resumen en texto plano para pegar en el informe. */
export function reportSummary(trials: readonly TiltTrial[], context: { device: string; date?: Date }): string {
  const summaries = summarizeByReference(trials);
  const header = [
    "LabMotion — Medición de inclinación",
    `Fecha: ${(context.date ?? new Date()).toLocaleString("es-CL")}`,
    `Dispositivo / navegador: ${context.device}`,
    `Versión del cálculo: ${TILT_CALC_VERSION}`,
    "Fórmula: θ = atan2(√(gx² + gy²), |gz|), con g = a_total − a_lineal",
    "",
    "Ref. | P1 | P2 | P3 | Promedio | Error abs. | Error %",
  ];
  const rows = summaries.map((summary) => {
    const byAttempt = new Map(summary.trials.map((trial) => [trial.attempt, trial]));
    const cells = [1, 2, 3].map((attempt) => {
      const trial = byAttempt.get(attempt);
      return trial ? formatNumber(trial.meanDeg, 1) : "—";
    });
    const extra = summary.trials.filter((trial) => trial.attempt > 3).length;
    return [
      `${formatNumber(summary.referenceDeg, summary.referenceDeg % 1 === 0 ? 0 : 1)}°`,
      ...cells,
      `${formatNumber(summary.meanDeg, 1)}° (n=${summary.n}${extra ? `, incluye ${extra} extra` : ""})`,
      `${formatNumber(summary.absErrorDeg, 1)}°`,
      summary.percentError === null ? "No aplica" : formatPercent(summary.percentError),
    ].join(" | ");
  });
  return [...header, ...rows, "", ...buildConclusion(trials)].join("\n");
}

// ── Persistencia local (solo este navegador) ────────────────────────────

const STORAGE_KEY = "labmotion.v2.tilt.trials";
const STORAGE_VERSION = 1;

type StoredTrials = { version: number; trials: readonly TiltTrial[] };

function isTrial(value: unknown): value is TiltTrial {
  if (!value || typeof value !== "object") return false;
  const trial = value as Partial<TiltTrial>;
  return typeof trial.id === "string"
    && typeof trial.referenceDeg === "number"
    && typeof trial.meanDeg === "number"
    && typeof trial.attempt === "number"
    && Array.isArray(trial.samples);
}

export function loadTrials(storage: Storage | null = safeStorage()): TiltTrial[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<StoredTrials>;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.trials)) return [];
    return parsed.trials.filter(isTrial);
  } catch {
    return [];
  }
}

/** Devuelve false si el navegador no permitió guardar (cuota o modo privado). */
export function saveTrials(trials: readonly TiltTrial[], storage: Storage | null = safeStorage()): boolean {
  if (!storage) return false;
  try {
    if (trials.length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, trials } satisfies StoredTrials));
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
