import { gravedadEstimada, magnitudDeVector, type Vector3 } from "../../lib/fisica";
import type { Axis, MotionSample } from "../../lib/sensors";

/** Versión del cálculo: se exporta con cada medición para poder reproducirla. */
export const TILT_CALC_VERSION = "labmotion-tilt-1.0.0";

/** Gravedad terrestre aproximada. Solo se usa como referencia explicativa. */
export const GRAVEDAD_REFERENCIA = 9.81;

/**
 * Origen del vector de gravedad de una muestra:
 * - "diferencia": g = a_total − a_lineal (ambas lecturas completas).
 * - "reposo": solo existe a_total; se usa como gravedad, válido únicamente
 *   con el teléfono quieto ("estimación en reposo").
 */
export type GravityMode = "diferencia" | "reposo";

/**
 * Umbrales del laboratorio. Son configurables y deben ajustarse con pruebas
 * reales; cumplirlos NO demuestra precisión, solo que la lectura está quieta.
 */
export type TiltConfig = {
  /** Ventana móvil para decidir si la lectura está estable. */
  windowMs: number;
  /** Mínimo de lecturas válidas dentro de la ventana. */
  minSamplesInWindow: number;
  /** La ventana debe cubrir al menos esta fracción de windowMs. */
  minWindowCoverage: number;
  /** Desviación estándar máxima del ángulo dentro de la ventana. */
  maxStdDeg: number;
  /** Rango (máx − mín) máximo del ángulo dentro de la ventana. */
  maxRangeDeg: number;
  /** Magnitud media máxima de la aceleración lineal (si existe). */
  maxLinearAccel: number;
  /** Magnitud máxima de la velocidad angular (si existe). */
  maxRotationRate: number;
  /** |g| aceptable: fuera de este rango la lectura no es confiable. */
  minGravity: number;
  maxGravity: number;
  /** Sin muestras durante este tiempo se considera perdida la señal. */
  staleMs: number;
  /**
   * Tras tocar «Medir», tiempo mínimo antes de aceptar la ventana estable:
   * el toque mueve el teléfono y esas muestras no deben entrar al promedio.
   */
  settleMs: number;
  /** Duración del intervalo estable que se promedia en cada prueba. */
  captureMs: number;
  /** Tiempo máximo esperando estabilidad antes de abandonar la prueba. */
  waitTimeoutMs: number;
  /** Bajo este ángulo se describe la pantalla como "casi horizontal". */
  nearZeroDeg: number;
  /** Historial que se conserva para el gráfico en vivo. */
  historyMs: number;
};

export const DEFAULT_TILT_CONFIG: TiltConfig = {
  windowMs: 1000,
  minSamplesInWindow: 8,
  minWindowCoverage: 0.6,
  maxStdDeg: 0.5,
  maxRangeDeg: 2,
  maxLinearAccel: 0.3,
  maxRotationRate: 6,
  minGravity: 7,
  maxGravity: 12.5,
  staleMs: 700,
  settleMs: 1200,
  captureMs: 2000,
  waitTimeoutMs: 25000,
  nearZeroDeg: 2,
  historyMs: 12000,
};

export type TiltReading = {
  tMs: number;
  mode: GravityMode;
  aTotal: Vector3;
  aLinear: Vector3 | null;
  gravity: Vector3;
  gravityMagnitude: number;
  thetaDeg: number;
  linearMagnitude: number | null;
  rotationMagnitude: number | null;
};

export type TiltFailureReason = "sin-datos" | "componentes-incompletos" | "amplitud-invalida";

export type TiltResult =
  | { ok: true; reading: TiltReading }
  | { ok: false; tMs: number; reason: TiltFailureReason; detail: string; gravityMagnitude: number | null };

function completeVector(axis: Axis): Vector3 | null {
  if (axis.x === null || axis.y === null || axis.z === null) return null;
  return { x: axis.x, y: axis.y, z: axis.z };
}

function hasAny(axis: Axis): boolean {
  return axis.x !== null || axis.y !== null || axis.z !== null;
}

// #region inclinacionDeSuperficie
/**
 * Inclinacion de la pantalla respecto a la horizontal, sin signo (0-90 grados).
 * theta = atan2(raiz(gx^2 + gy^2), |gz|) * 180 / pi
 * Pantalla horizontal (gravedad solo en Z) -> 0 grados.
 * Pantalla vertical (gravedad solo en X/Y) -> 90 grados.
 * No indica hacia que borde se inclino: dos lados distintos dan el mismo valor.
 */
export function inclinacionDeSuperficie(g: Vector3): number | null {
  const horizontal = Math.hypot(g.x, g.y);
  const vertical = Math.abs(g.z);
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical)) return null;
  if (horizontal === 0 && vertical === 0) return null;
  return (Math.atan2(horizontal, vertical) * 180) / Math.PI;
}
// #endregion

// #region lecturaDeInclinacion
/**
 * Convierte una muestra del sensor en una lectura de inclinacion.
 * 1. Si hay a_total y a_lineal completas: g = a_total - a_lineal.
 * 2. Si solo hay a_total: g ~ a_total ("estimacion en reposo").
 * 3. Si |g| esta fuera del rango aceptado, no hay lectura confiable.
 * Nunca devuelve 0 grados por defecto cuando faltan datos.
 */
export function lecturaDeInclinacion(
  sample: MotionSample,
  config: TiltConfig = DEFAULT_TILT_CONFIG,
): TiltResult {
  const aTotal = completeVector(sample.accelerationIncludingGravity);
  const aLinear = completeVector(sample.acceleration);

  if (!aTotal) {
    const partial = hasAny(sample.accelerationIncludingGravity);
    return {
      ok: false,
      tMs: sample.tMs,
      reason: partial ? "componentes-incompletos" : "sin-datos",
      detail: partial
        ? "La aceleración con gravedad llegó sin alguno de sus ejes X, Y o Z."
        : "El navegador no entrega aceleración con gravedad.",
      gravityMagnitude: null,
    };
  }

  const mode: GravityMode = aLinear ? "diferencia" : "reposo";
  const gravity = aLinear ? gravedadEstimada(aTotal, aLinear) : aTotal;
  const gravityMagnitude = magnitudDeVector(gravity);

  if (!Number.isFinite(gravityMagnitude) || gravityMagnitude < config.minGravity || gravityMagnitude > config.maxGravity) {
    return {
      ok: false,
      tMs: sample.tMs,
      reason: "amplitud-invalida",
      detail: `|g| = ${Number.isFinite(gravityMagnitude) ? gravityMagnitude.toFixed(2) : "?"} m/s², fuera del rango aceptado (${config.minGravity}–${config.maxGravity} m/s²).`,
      gravityMagnitude: Number.isFinite(gravityMagnitude) ? gravityMagnitude : null,
    };
  }

  const thetaDeg = inclinacionDeSuperficie(gravity);
  if (thetaDeg === null) {
    return { ok: false, tMs: sample.tMs, reason: "amplitud-invalida", detail: "Vector de gravedad nulo.", gravityMagnitude };
  }

  const rotation = completeVector(sample.rotationRate);
  return {
    ok: true,
    reading: {
      tMs: sample.tMs,
      mode,
      aTotal,
      aLinear,
      gravity,
      gravityMagnitude,
      thetaDeg,
      linearMagnitude: aLinear ? magnitudDeVector(aLinear) : null,
      rotationMagnitude: rotation ? magnitudDeVector(rotation) : null,
    },
  };
}
// #endregion

export type Stats = {
  n: number;
  mean: number;
  /** Desviación estándar muestral (N − 1); null con menos de 2 valores. */
  std: number | null;
  min: number;
  max: number;
  range: number;
};

// #region estadisticas
/**
 * Media, desviacion estandar muestral y rango de una serie.
 * media = suma(theta_i) / N
 * s = raiz( suma((theta_i - media)^2) / (N - 1) )
 */
export function estadisticas(values: readonly number[]): Stats | null {
  const finite = values.filter((value) => Number.isFinite(value));
  const n = finite.length;
  if (n === 0) return null;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const value of finite) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const mean = sum / n;
  let squares = 0;
  for (const value of finite) squares += (value - mean) ** 2;
  return {
    n,
    mean,
    std: n > 1 ? Math.sqrt(squares / (n - 1)) : null,
    min,
    max,
    range: max - min,
  };
}
// #endregion

// #region errores
/**
 * Error absoluto en grados: |media - referencia|.
 * Error porcentual: |media - referencia| / |referencia| * 100.
 * Con referencia 0 grados el porcentaje no aplica (division por cero).
 */
export function errorAbsoluto(medido: number, referencia: number): number {
  return Math.abs(medido - referencia);
}

export function errorPorcentual(medido: number, referencia: number): number | null {
  if (!Number.isFinite(medido) || !Number.isFinite(referencia) || referencia === 0) return null;
  return (Math.abs(medido - referencia) / Math.abs(referencia)) * 100;
}
// #endregion

export type StabilityState = "stable" | "moving" | "insufficient";

export type Stability = {
  state: StabilityState;
  reason: string;
  n: number;
  spanMs: number;
  meanDeg: number | null;
  stdDeg: number | null;
  rangeDeg: number | null;
  meanLinear: number | null;
  maxRotation: number | null;
};

const INSUFFICIENT = (reason: string, n = 0, spanMs = 0): Stability => ({
  state: "insufficient",
  reason,
  n,
  spanMs,
  meanDeg: null,
  stdDeg: null,
  rangeDeg: null,
  meanLinear: null,
  maxRotation: null,
});

// #region evaluarEstabilidad
/**
 * Decide si la lectura esta quieta usando una ventana movil (por defecto 1 s):
 * - suficientes lecturas validas y la ventana cubierta,
 * - desviacion estandar y rango del angulo bajo el umbral,
 * - aceleracion lineal media y velocidad angular bajo el umbral (si existen).
 * El giroscopio solo ayuda a detectar movimiento; no entra en la formula.
 */
export function evaluarEstabilidad(
  readings: readonly TiltReading[],
  nowMs: number,
  config: TiltConfig = DEFAULT_TILT_CONFIG,
): Stability {
  const last = readings[readings.length - 1];
  if (!last) return INSUFFICIENT("Sin lecturas válidas.");
  if (nowMs - last.tMs > config.staleMs) return INSUFFICIENT("Se perdió la señal del sensor.");

  const window = readings.filter((reading) => reading.tMs >= nowMs - config.windowMs);
  const n = window.length;
  const spanMs = n > 1 ? window[n - 1].tMs - window[0].tMs : 0;
  if (n < config.minSamplesInWindow || spanMs < config.windowMs * config.minWindowCoverage) {
    return INSUFFICIENT("Reuniendo muestras para evaluar la estabilidad…", n, spanMs);
  }

  const angles = estadisticas(window.map((reading) => reading.thetaDeg));
  const linear = window.flatMap((reading) => (reading.linearMagnitude === null ? [] : [reading.linearMagnitude]));
  const rotation = window.flatMap((reading) => (reading.rotationMagnitude === null ? [] : [reading.rotationMagnitude]));
  const meanLinear = linear.length ? linear.reduce((sum, value) => sum + value, 0) / linear.length : null;
  const maxRotation = rotation.length ? Math.max(...rotation) : null;

  const base = {
    n,
    spanMs,
    meanDeg: angles?.mean ?? null,
    stdDeg: angles?.std ?? null,
    rangeDeg: angles?.range ?? null,
    meanLinear,
    maxRotation,
  };

  if (angles && angles.std !== null && angles.std > config.maxStdDeg) {
    return { ...base, state: "moving", reason: `El ángulo varía (σ = ${angles.std.toFixed(2)}° > ${config.maxStdDeg}°).` };
  }
  if (angles && angles.range > config.maxRangeDeg) {
    return { ...base, state: "moving", reason: `El ángulo cambió ${angles.range.toFixed(2)}° en la ventana (máx. ${config.maxRangeDeg}°).` };
  }
  if (meanLinear !== null && meanLinear > config.maxLinearAccel) {
    return { ...base, state: "moving", reason: `Aceleración lineal media ${meanLinear.toFixed(2)} m/s² (máx. ${config.maxLinearAccel}).` };
  }
  if (maxRotation !== null && maxRotation > config.maxRotationRate) {
    return { ...base, state: "moving", reason: `Giro detectado: ${maxRotation.toFixed(1)} °/s (máx. ${config.maxRotationRate}).` };
  }
  return { ...base, state: "stable", reason: "Lectura quieta dentro de los umbrales." };
}
// #endregion

/** Texto breve bajo la cifra grande de la demostración. */
export function describirInclinacion(
  thetaDeg: number | null,
  stability: StabilityState,
  config: TiltConfig = DEFAULT_TILT_CONFIG,
): string {
  if (thetaDeg === null) return "No hay lectura confiable";
  if (stability === "moving") return "Mantén el teléfono quieto para medir con mayor estabilidad";
  if (thetaDeg <= config.nearZeroDeg) return "Está casi horizontal";
  if (thetaDeg >= 90 - config.nearZeroDeg) return "Está casi vertical";
  return "El teléfono está inclinado";
}

export function stabilityLabel(state: StabilityState): string {
  if (state === "stable") return "Estable";
  if (state === "moving") return "En movimiento";
  return "Señal insuficiente";
}

export function gravityModeLabel(mode: GravityMode): string {
  return mode === "diferencia" ? "g = a_total − a_lineal" : "Estimación en reposo (solo a_total)";
}

/**
 * Vector sintético para la simulación y las pruebas: gravedad de 9,81 m/s²
 * inclinada θ grados sobre el eje X. Nunca se mezcla con datos reales.
 */
export function vectorSintetico(thetaDeg: number, magnitude = GRAVEDAD_REFERENCIA): Vector3 {
  const radians = (thetaDeg * Math.PI) / 180;
  return { x: magnitude * Math.sin(radians), y: 0, z: magnitude * Math.cos(radians) };
}
