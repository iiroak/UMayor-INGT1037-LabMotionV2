import type { Diagnostics } from "../../lib/diagnostics";
import { csvNumber } from "../../lib/format";
import { gravedadEstimada, magnitudDeVector } from "../../lib/fisica";
import type { MotionSample } from "../../lib/sensors";
import { DEFAULT_TILT_CONFIG, TILT_CALC_VERSION, inclinacionDeSuperficie, lecturaDeInclinacion } from "./tiltPhysics";
import { summarizeByReference, type TiltTrial } from "./tiltSession";

export const TILT_EXPORT_FORMAT = "labmotion-tilt-session-v1";

export type ExportContext = {
  diagnostics: Diagnostics | null;
  exportedAt?: Date;
};

const CSV_HEADER_COMMENT = (exportedAt: Date) => [
  `# LabMotion V2 | Laboratorio de inclinación | formato ${TILT_EXPORT_FORMAT}`,
  `# Exportado: ${exportedAt.toISOString()} | cálculo ${TILT_CALC_VERSION}`,
  "# theta = atan2(sqrt(gx^2 + gy^2), |gz|); g = a_total - a_lineal (modo diferencia) o g = a_total (modo reposo)",
  "# Referencia = ángulo del transportador físico ingresado por el usuario. Datos reales del sensor del dispositivo.",
];

function quote(text: string): string {
  return `"${text.replaceAll('"', '""')}"`;
}

/** Una fila por prueba: lo necesario para la tabla del informe. */
export function trialsCsv(trials: readonly TiltTrial[], exportedAt = new Date()): string {
  const header = [
    "trial_id", "created_at", "reference_deg", "attempt", "mean_deg", "std_deg", "min_deg", "max_deg", "range_deg",
    "abs_error_deg", "percent_error", "valid_samples", "total_samples", "duration_ms", "frequency_hz", "gravity_mode",
    "mean_gravity_m_s2", "quality", "warnings", "screen_orientation", "wait_ms", "restarts", "calc_version",
  ].join(",");
  const rows = [...trials]
    .sort((a, b) => a.referenceDeg - b.referenceDeg || a.attempt - b.attempt)
    .map((trial) => [
      trial.id,
      trial.createdAt,
      csvNumber(trial.referenceDeg, 2),
      String(trial.attempt),
      csvNumber(trial.meanDeg, 4),
      csvNumber(trial.stdDeg, 4),
      csvNumber(trial.minDeg, 4),
      csvNumber(trial.maxDeg, 4),
      csvNumber(trial.rangeDeg, 4),
      csvNumber(trial.absErrorDeg, 4),
      trial.percentError === null ? "no_aplica" : csvNumber(trial.percentError, 3),
      String(trial.validSamples),
      String(trial.totalSamples),
      csvNumber(trial.durationMs, 1),
      csvNumber(trial.frequencyHz, 2),
      trial.mode,
      csvNumber(trial.meanGravity, 4),
      trial.quality,
      quote(trial.warnings.join(" | ")),
      trial.screenOrientation,
      csvNumber(trial.waitMs, 0),
      String(trial.restarts),
      trial.calcVersion,
    ].join(","));
  return [...CSV_HEADER_COMMENT(exportedAt), header, ...rows].join("\n");
}

function sampleRow(trial: TiltTrial, sample: MotionSample, t0: number): string {
  const result = lecturaDeInclinacion(sample, trial.config ?? DEFAULT_TILT_CONFIG);
  const reading = result.ok ? result.reading : null;
  const aTotal = sample.accelerationIncludingGravity;
  const aLin = sample.acceleration;
  return [
    trial.id,
    csvNumber(trial.referenceDeg, 2),
    String(trial.attempt),
    csvNumber(sample.tMs - t0, 2),
    csvNumber(aTotal.x), csvNumber(aTotal.y), csvNumber(aTotal.z),
    csvNumber(aLin.x), csvNumber(aLin.y), csvNumber(aLin.z),
    csvNumber(reading?.gravity.x), csvNumber(reading?.gravity.y), csvNumber(reading?.gravity.z),
    csvNumber(reading?.gravityMagnitude),
    csvNumber(reading?.thetaDeg),
    reading ? reading.mode : `invalida:${result.ok ? "" : result.reason}`,
    csvNumber(sample.rotationRate.x), csvNumber(sample.rotationRate.y), csvNumber(sample.rotationRate.z),
    csvNumber(sample.intervalMs, 2),
  ].join(",");
}

/** Muestras originales de todas las pruebas en formato largo (una fila por muestra). */
export function samplesCsv(trials: readonly TiltTrial[], exportedAt = new Date()): string {
  const header = [
    "trial_id", "reference_deg", "attempt", "t_ms",
    "ax_total_m_s2", "ay_total_m_s2", "az_total_m_s2",
    "ax_lin_m_s2", "ay_lin_m_s2", "az_lin_m_s2",
    "gx_m_s2", "gy_m_s2", "gz_m_s2", "g_mag_m_s2", "theta_deg", "gravity_mode",
    "rot_alpha_deg_s", "rot_beta_deg_s", "rot_gamma_deg_s", "interval_ms",
  ].join(",");
  const rows = [...trials]
    .sort((a, b) => a.referenceDeg - b.referenceDeg || a.attempt - b.attempt)
    .flatMap((trial) => {
      const t0 = trial.samples[0]?.tMs ?? 0;
      return trial.samples.map((sample) => sampleRow(trial, sample, t0));
    });
  return [...CSV_HEADER_COMMENT(exportedAt), header, ...rows].join("\n");
}

/** Sesión completa: metadatos, configuración, diagnóstico, pruebas y muestras. */
export function sessionJson(trials: readonly TiltTrial[], context: ExportContext): string {
  const exportedAt = context.exportedAt ?? new Date();
  return JSON.stringify(
    {
      project: "LabMotion V2",
      format: TILT_EXPORT_FORMAT,
      experiment: "Medición de inclinación de un smartphone con su acelerómetro",
      exportedAt: exportedAt.toISOString(),
      calcVersion: TILT_CALC_VERSION,
      dataOrigin: "Sensores reales del dispositivo (DeviceMotionEvent). La simulación nunca se exporta.",
      model: {
        gravity: "g = accelerationIncludingGravity - acceleration (modo diferencia) | g = accelerationIncludingGravity (modo reposo)",
        tilt: "theta = atan2(sqrt(gx^2 + gy^2), |gz|) * 180 / pi",
        meanOfTrial: "media aritmética de theta en la ventana estable",
        absoluteError: "|media - referencia|",
        percentError: "|media - referencia| / |referencia| * 100 (no aplica con referencia 0)",
        reference: "ángulo del transportador físico ingresado por el usuario",
      },
      config: trials[0]?.config ?? DEFAULT_TILT_CONFIG,
      diagnostics: context.diagnostics,
      summary: summarizeByReference(trials).map(({ trials: list, ...rest }) => ({
        ...rest,
        trialIds: list.map((trial) => trial.id),
      })),
      trials: trials.map((trial) => {
        const t0 = trial.samples[0]?.tMs ?? 0;
        return {
          ...trial,
          samples: trial.samples.map((sample) => ({ ...sample, tMs: Number((sample.tMs - t0).toFixed(2)) })),
          angles: trial.angles.map((angle) => ({ tMs: Number((angle.tMs - t0).toFixed(2)), thetaDeg: angle.thetaDeg })),
        };
      }),
    },
    null,
    2,
  );
}

/** Recalcula θ de una muestra con las funciones públicas (usado en pruebas de reproducibilidad). */
export function recomputeTheta(sample: MotionSample): number | null {
  const aTotal = sample.accelerationIncludingGravity;
  const aLin = sample.acceleration;
  if (aTotal.x === null || aTotal.y === null || aTotal.z === null) return null;
  const total = { x: aTotal.x, y: aTotal.y, z: aTotal.z };
  const gravity = aLin.x !== null && aLin.y !== null && aLin.z !== null
    ? gravedadEstimada(total, { x: aLin.x, y: aLin.y, z: aLin.z })
    : total;
  return magnitudDeVector(gravity) === 0 ? null : inclinacionDeSuperficie(gravity);
}
