import { frecuenciaDeMuestreo, integrarTrapecio } from "../../lib/fisica";
import type { Axis, MotionSample } from "../../lib/sensors";
import { estadisticas, inclinacionDeSuperficie } from "../tilt/tiltPhysics";

/** Versión del cálculo: se exporta con cada prueba para poder reproducirla. */
export const MOTION_CALC_VERSION = "labmotion-motion-1.0.0";

export type MotionKind = "mru" | "mrua";

/**
 * Origen de la aceleración usada:
 * - "con-gravedad": `accelerationIncludingGravity`, sin filtros del sistema.
 * - "lineal": `acceleration`, que el sistema ya filtró y puede distorsionar una
 *   aceleración sostenida. Solo se usa si el navegador no entrega la otra.
 */
export type AccelSource = "con-gravedad" | "lineal";

/**
 * Umbrales del laboratorio. Son configurables y deben ajustarse con pruebas
 * reales: cumplirlos indica que la lectura es coherente, no que sea precisa.
 */
export type MotionConfig = {
  /** Ventana de reposo que se promedia para fijar la línea base. */
  restWindowMs: number;
  minRestSamples: number;
  /** Desviación estándar máxima de cada eje en reposo (m/s²). */
  maxRestStd: number;
  /** Velocidad angular máxima en reposo (°/s). */
  maxRestRotation: number;
  minGravity: number;
  maxGravity: number;
  /** Sin muestras durante este tiempo se considera perdida la señal. */
  staleMs: number;
  /** Tras tocar «Preparar», tiempo antes de aceptar el reposo (el toque mueve el teléfono). */
  settleMs: number;
  /**
   * Tiempo adicional que el reposo debe mantenerse estable y con el mismo promedio
   * antes de dar la línea base por buena. Una aceleración constante de más de 1 s
   * también tiene poca varianza; este margen evita confundirla con reposo.
   */
  restHoldMs: number;
  /** Cambio del promedio en reposo (m/s²) que reinicia ese margen. */
  restShiftTolerance: number;
  /** Tiempo máximo esperando el reposo. */
  restTimeoutMs: number;
  /** Tiempo máximo esperando el movimiento una vez preparado. */
  armTimeoutMs: number;
  /** Muestras anteriores al inicio del movimiento que se conservan. */
  preRollMs: number;
  /** Aceleración mínima (m/s²) que cuenta como movimiento. */
  triggerAccel: number;
  /** El umbral nunca baja de `noiseFactor` veces el ruido medido en reposo. */
  noiseFactor: number;
  /** Ventana del promedio móvil que suaviza la aceleración. */
  smoothMs: number;
  /** Calma necesaria para dar por terminado el movimiento. */
  quietMs: number;
  /** Duración máxima de una grabación desde el inicio del movimiento. */
  maxRecordMs: number;
  /** Un hueco mayor entre muestras invalida la prueba. */
  maxGapMs: number;
  minRateHz: number;
  warnRateHz: number;
  /** Margen que se descarta en cada extremo del tramo que se ajusta. */
  fitTrimMs: number;
  /** MRU: duración mínima del tramo de crucero. */
  minCruiseMs: number;
  /** MRU: velocidad máxima mínima (m/s). */
  minPeakSpeed: number;
  /** MRU: el crucero debe ir al menos a esta fracción de la velocidad máxima. */
  cruiseSpeedShare: number;
  /** MRU: deriva removida / velocidad máxima: aviso y rechazo. */
  warnDriftShare: number;
  maxDriftShare: number;
  /** MRU: inclinación máxima de la superficie (°); sobre ella ya no es uniforme. */
  maxFlatDeg: number;
  /** MRUA: rango de inclinación de la rampa (°). */
  minRampDeg: number;
  maxRampDeg: number;
  /** MRUA: duración mínima de la meseta de aceleración constante. */
  minWindowMs: number;
  /** MRUA: tramo con el que se compara la meseta (desde/hasta, tras el inicio). */
  plateauRefFromMs: number;
  plateauRefToMs: number;
  /** MRUA: la meseta termina cuando la aceleración se aleja más de esta fracción. */
  plateauTolerance: number;
  /** Giro (°/s) que genera un aviso y giro que invalida la prueba. */
  rotationWarn: number;
  rotationFail: number;
  /** MRUA: |cos| mínimo entre el movimiento y la línea de máxima pendiente. */
  alignWarn: number;
  /** Frecuencia máxima de la serie que se guarda. */
  storedRateHz: number;
  /** Historial del gráfico en vivo. */
  historyMs: number;
};

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  restWindowMs: 1000,
  minRestSamples: 20,
  maxRestStd: 0.15,
  maxRestRotation: 8,
  minGravity: 7,
  maxGravity: 12.5,
  staleMs: 700,
  settleMs: 1000,
  restHoldMs: 600,
  restShiftTolerance: 0.1,
  restTimeoutMs: 20000,
  armTimeoutMs: 30000,
  preRollMs: 300,
  triggerAccel: 0.4,
  noiseFactor: 6,
  smoothMs: 80,
  quietMs: 500,
  maxRecordMs: 8000,
  maxGapMs: 100,
  minRateHz: 15,
  warnRateHz: 30,
  fitTrimMs: 100,
  minCruiseMs: 300,
  minPeakSpeed: 0.15,
  cruiseSpeedShare: 0.6,
  warnDriftShare: 0.25,
  maxDriftShare: 0.6,
  maxFlatDeg: 10,
  minRampDeg: 3,
  maxRampDeg: 60,
  minWindowMs: 500,
  plateauRefFromMs: 150,
  plateauRefToMs: 500,
  plateauTolerance: 0.6,
  rotationWarn: 30,
  rotationFail: 90,
  alignWarn: 0.85,
  storedRateHz: 50,
  historyMs: 8000,
};

export type Vec3 = { x: number; y: number; z: number };

function completo(axis: Axis): Vec3 | null {
  const { x, y, z } = axis;
  if (x === null || y === null || z === null) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return { x, y, z };
}

/** Vector de aceleración de una muestra según la fuente elegida. */
export function vectorDeAceleracion(sample: MotionSample, source: AccelSource): Vec3 | null {
  return completo(source === "con-gravedad" ? sample.accelerationIncludingGravity : sample.acceleration);
}

function magnitudDeGiro(sample: MotionSample): number | null {
  const v = completo(sample.rotationRate);
  return v ? Math.hypot(v.x, v.y, v.z) : null;
}

// ── Línea base en reposo ───────────────────────────────────────────────

export type Baseline = {
  n: number;
  spanMs: number;
  source: AccelSource;
  /** Vector medio en reposo (m/s²). Se resta a cada muestra del movimiento. */
  mean: Vec3;
  /** Desviación estándar de cada eje (m/s²). */
  std: Vec3;
  /** Ruido en el plano de la pantalla: hypot(std.x, std.y). */
  noise: number;
  /** |g| medido en reposo (solo con la fuente «con-gravedad»). */
  gravity: number | null;
  /** Inclinación de la superficie respecto de la horizontal (°). */
  thetaDeg: number | null;
  maxRotation: number | null;
};

export type RestEvaluation =
  | { state: "insufficient"; reason: string; n: number }
  | { state: "moving"; reason: string; n: number }
  | { state: "rest"; reason: string; n: number; baseline: Baseline };

// #region lineaBase
/**
 * Línea base: el vector de aceleración medio con el teléfono quieto.
 *   base = promedio(lecturas en reposo)
 * Contiene la gravedad y el sesgo del sensor. Al restarla de cada lectura
 * posterior queda solo la aceleración real del movimiento:
 *   a_movimiento(t) = lectura(t) − base
 * En una rampa, la componente de la gravedad a lo largo de la pendiente también
 * queda incluida en la base, así que no hay que corregirla aparte.
 */
export function evaluarReposo(
  samples: readonly MotionSample[],
  nowMs: number,
  config: MotionConfig = DEFAULT_MOTION_CONFIG,
): RestEvaluation {
  const last = samples[samples.length - 1];
  if (!last) return { state: "insufficient", reason: "Sin lecturas.", n: 0 };
  if (nowMs - last.tMs > config.staleMs) return { state: "insufficient", reason: "Se perdió la señal del sensor.", n: 0 };
  const window = samples.filter((sample) => sample.tMs >= nowMs - config.restWindowMs);
  const n = window.length;
  const spanMs = n > 1 ? window[n - 1].tMs - window[0].tMs : 0;
  if (n < config.minRestSamples || spanMs < config.restWindowMs * 0.7) {
    return { state: "insufficient", reason: "Reuniendo muestras para medir el reposo…", n };
  }
  let source: AccelSource = "con-gravedad";
  let vectors = window.map((sample) => vectorDeAceleracion(sample, source));
  if (vectors.some((vector) => vector === null)) {
    source = "lineal";
    vectors = window.map((sample) => vectorDeAceleracion(sample, source));
  }
  if (vectors.some((vector) => vector === null)) {
    return { state: "insufficient", reason: "El sensor no entrega las tres componentes de la aceleración.", n };
  }
  const list = vectors as Vec3[];
  const sx = estadisticas(list.map((vector) => vector.x));
  const sy = estadisticas(list.map((vector) => vector.y));
  const sz = estadisticas(list.map((vector) => vector.z));
  if (!sx || !sy || !sz) return { state: "insufficient", reason: "Sin lecturas válidas.", n };
  const std: Vec3 = { x: sx.std ?? 0, y: sy.std ?? 0, z: sz.std ?? 0 };
  const worst = Math.max(std.x, std.y, std.z);
  if (worst > config.maxRestStd) {
    return { state: "moving", reason: `El teléfono se mueve (σ = ${worst.toFixed(2)} m/s², máx. ${config.maxRestStd}).`, n };
  }
  const rotations = window.flatMap((sample) => {
    const rotation = magnitudDeGiro(sample);
    return rotation === null ? [] : [rotation];
  });
  const maxRotation = rotations.length ? Math.max(...rotations) : null;
  if (maxRotation !== null && maxRotation > config.maxRestRotation) {
    return { state: "moving", reason: `Giro detectado: ${maxRotation.toFixed(1)} °/s (máx. ${config.maxRestRotation}).`, n };
  }
  const mean: Vec3 = { x: sx.mean, y: sy.mean, z: sz.mean };
  const gravity = source === "con-gravedad" ? Math.hypot(mean.x, mean.y, mean.z) : null;
  if (gravity !== null && (gravity < config.minGravity || gravity > config.maxGravity)) {
    return { state: "insufficient", reason: `|g| = ${gravity.toFixed(2)} m/s² fuera del rango esperado.`, n };
  }
  const baseline: Baseline = {
    n,
    spanMs,
    source,
    mean,
    std,
    noise: Math.hypot(std.x, std.y),
    gravity,
    thetaDeg: source === "con-gravedad" ? inclinacionDeSuperficie(mean) : null,
    maxRotation,
  };
  return { state: "rest", reason: "Teléfono quieto.", n, baseline };
}
// #endregion

/** Aceleración de una muestra menos la línea base, en el plano de la pantalla. */
export function deltaEnPlano(sample: MotionSample, baseline: Baseline): { x: number; y: number } | null {
  const vector = vectorDeAceleracion(sample, baseline.source);
  if (!vector) return null;
  return { x: vector.x - baseline.mean.x, y: vector.y - baseline.mean.y };
}

/** Umbral de movimiento: nunca menos de `noiseFactor` veces el ruido en reposo. */
export function umbralDeAceleracion(baseline: Baseline, config: MotionConfig = DEFAULT_MOTION_CONFIG): number {
  return Math.max(config.triggerAccel, config.noiseFactor * baseline.noise);
}

// ── Ajustes por mínimos cuadrados ──────────────────────────────────────

export type LinearFit = { slope: number; intercept: number; r2: number; n: number };
export type QuadraticFit = { c0: number; c1: number; c2: number; r2: number; n: number };

// #region ajustes
/**
 * Ajuste lineal y = m·t + b por mínimos cuadrados.
 *   m = Σ(t−t̄)(y−ȳ) / Σ(t−t̄)²      b = ȳ − m·t̄
 *   R² = 1 − Σ(residuo²) / Σ(y−ȳ)²
 */
export function ajusteLineal(t: readonly number[], y: readonly number[]): LinearFit | null {
  const n = Math.min(t.length, y.length);
  if (n < 2) return null;
  let mt = 0;
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    mt += t[i];
    my += y[i];
  }
  mt /= n;
  my /= n;
  let stt = 0;
  let sty = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    stt += (t[i] - mt) ** 2;
    sty += (t[i] - mt) * (y[i] - my);
    syy += (y[i] - my) ** 2;
  }
  if (stt === 0) return null;
  const slope = sty / stt;
  const intercept = my - slope * mt;
  const r2 = syy === 0 ? 1 : (sty * sty) / (stt * syy);
  return { slope, intercept, r2, n };
}

/**
 * Ajuste cuadrático y = c0 + c1·t + c2·t². Para una posición con aceleración
 * constante, c2 = a/2 (x = x0 + v0·t + ½·a·t²). Se resuelven las ecuaciones
 * normales con el tiempo centrado, que evita errores numéricos.
 */
export function ajusteCuadratico(t: readonly number[], y: readonly number[]): QuadraticFit | null {
  const n = Math.min(t.length, y.length);
  if (n < 3) return null;
  let tm = 0;
  for (let i = 0; i < n; i += 1) tm += t[i];
  tm /= n;
  const s = [0, 0, 0, 0, 0];
  const r = [0, 0, 0];
  let my = 0;
  for (let i = 0; i < n; i += 1) {
    const u = t[i] - tm;
    let power = 1;
    for (let k = 0; k <= 4; k += 1) {
      s[k] += power;
      if (k <= 2) r[k] += y[i] * power;
      power *= u;
    }
    my += y[i];
  }
  my /= n;
  const det3 = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const matrix = [
    [s[0], s[1], s[2]],
    [s[1], s[2], s[3]],
    [s[2], s[3], s[4]],
  ];
  const det = det3(matrix);
  if (Math.abs(det) < 1e-12) return null;
  const solve = (column: number) => {
    const replaced = matrix.map((row, index) => row.map((value, j) => (j === column ? r[index] : value)));
    return det3(replaced) / det;
  };
  const d0 = solve(0);
  const d1 = solve(1);
  const d2 = solve(2);
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i += 1) {
    const u = t[i] - tm;
    ssRes += (y[i] - (d0 + d1 * u + d2 * u * u)) ** 2;
    ssTot += (y[i] - my) ** 2;
  }
  return {
    c0: d0 - d1 * tm + d2 * tm * tm,
    c1: d1 - 2 * d2 * tm,
    c2: d2,
    r2: ssTot === 0 ? 1 : 1 - ssRes / ssTot,
    n,
  };
}
// #endregion

/**
 * Comprueba que la superficie sirve para el laboratorio: horizontal para el MRU
 * (si no, la gravedad lo aceleraría) y inclinada, dentro de un rango, para el MRUA.
 * Devuelve el motivo del rechazo o null si es válida.
 */
export function comprobarSuperficie(kind: MotionKind, baseline: Baseline, config: MotionConfig = DEFAULT_MOTION_CONFIG): string | null {
  const theta = baseline.thetaDeg;
  if (kind === "mru") {
    if (theta !== null && theta > config.maxFlatDeg) {
      return `La superficie está inclinada ${theta.toFixed(1)}° (máx. ${config.maxFlatDeg}°): ya no sería movimiento uniforme. Usa una superficie horizontal.`;
    }
    return null;
  }
  if (theta === null || baseline.gravity === null) {
    return "El navegador no entrega la aceleración con gravedad, así que no se puede medir la inclinación de la rampa.";
  }
  if (theta < config.minRampDeg) return `La rampa está casi horizontal (${theta.toFixed(1)}°, mínimo ${config.minRampDeg}°): el teléfono no acelera.`;
  if (theta > config.maxRampDeg) return `La rampa está muy inclinada (${theta.toFixed(1)}°, máximo ${config.maxRampDeg}°).`;
  return null;
}

// #region comparacionTeorica
/**
 * Compara la aceleración medida con la de una rampa sin roce:
 *   a_ideal = g·sen θ
 *   μ = tan θ − a / (g·cos θ)        (despejado de a = g·(sen θ − μ·cos θ))
 */
export function comparacionTeorica(thetaDeg: number, gravity: number, aMean: number) {
  const rad = (thetaDeg * Math.PI) / 180;
  const aIdeal = gravity * Math.sin(rad);
  return {
    aIdeal,
    aDiff: aMean - aIdeal,
    aDiffPercent: aIdeal > 0 ? ((aMean - aIdeal) / aIdeal) * 100 : null,
    mu: Math.tan(rad) - aMean / (gravity * Math.cos(rad)),
  };
}
// #endregion

// ── Resultado de una prueba ────────────────────────────────────────────

export type MotionPoint = {
  /** Segundos desde el inicio del movimiento. */
  t: number;
  /** Aceleración a lo largo del eje de movimiento (m/s²). */
  a: number;
  /** Velocidad (m/s). */
  v: number;
  /** Posición (m), con 0 al inicio del movimiento. */
  x: number;
};

export type MruResult = {
  vCruise: number;
  /** Desviación estándar de v en el crucero dividida entre su media. */
  vVariation: number;
  /** Aceleración media en el crucero, ya corregida con el cero de velocidad (m/s²). */
  aCruise: number;
  cruiseFromS: number;
  cruiseToS: number;
  cruiseDurationS: number;
  /** x(t) en el crucero: pendiente (m/s) e intercepto (m). */
  xFit: LinearFit;
  /** Distancia recorrida durante el crucero (m). */
  cruiseDistance: number;
  /** Distancia desde el inicio del movimiento hasta detenerse (m). */
  totalDistance: number;
  vPeak: number;
  /** Velocidad residual al final antes de la corrección (m/s). */
  driftRemoved: number;
};

export type MruaResult = {
  thetaDeg: number;
  /** |g| medido en reposo (m/s²). */
  gravity: number;
  aMean: number;
  aStd: number;
  /** g·sinθ: aceleración sin roce. */
  aIdeal: number;
  aDiff: number;
  aDiffPercent: number | null;
  /** Coeficiente de roce cinético estimado: tanθ − a/(g·cosθ). */
  mu: number;
  windowFromS: number;
  windowToS: number;
  /** v(t) = v0 + a·t: la pendiente es la aceleración. */
  vFit: LinearFit;
  /** x(t) = c0 + c1·t + c2·t²: c2 debe valer a/2. */
  xFit: QuadraticFit;
  /** Distancia del tramo ajustado (m). */
  distance: number;
  /** Distancia desde el inicio del movimiento hasta el fin de la meseta (m). */
  totalDistance: number;
  vFinal: number;
  /** |cos| entre el movimiento y la línea de máxima pendiente (null sin pendiente fiable). */
  alignment: number | null;
};

export type MotionAnalysis = {
  version: string;
  kind: MotionKind;
  source: AccelSource;
  rateHz: number | null;
  /** Duración de la grabación desde el inicio del movimiento (s). */
  durationS: number;
  noise: number;
  threshold: number;
  /** Eje de movimiento en la pantalla (vector unitario; positivo = sentido del arranque). */
  axis: { x: number; y: number };
  /** Cuánto del movimiento cae en una sola línea (1 = recta perfecta). */
  linearity: number;
  thetaDeg: number | null;
  warnings: string[];
  series: MotionPoint[];
  mru?: MruResult;
  mrua?: MruaResult;
};

export type MotionAnalysisResult = { ok: true; analysis: MotionAnalysis } | { ok: false; reason: string };

const fail = (reason: string): { ok: false; reason: string } => ({ ok: false, reason });

// #region ejeDeMovimiento
/**
 * Eje de movimiento: la dirección en la que apunta la aceleración.
 * Se calcula con la matriz de segundo momento de los vectores a = (ax, ay):
 *   M = [Σax²  Σaxay; Σaxay  Σay²]
 * Su autovector mayor es la línea del movimiento, sin importar cómo se apoyó el
 * teléfono ni qué signo usa el navegador para sus ejes. `linealidad` vale 1 si
 * todos los vectores caen sobre una recta.
 */
export function ejeDeMovimiento(deltas: readonly { x: number; y: number }[]): { x: number; y: number; linearity: number } | null {
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const delta of deltas) {
    sxx += delta.x * delta.x;
    sxy += delta.x * delta.y;
    syy += delta.y * delta.y;
  }
  const trace = sxx + syy;
  if (!(trace > 0)) return null;
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const half = trace / 2;
  const radius = Math.sqrt(((sxx - syy) / 2) ** 2 + sxy * sxy);
  return { x: Math.cos(angle), y: Math.sin(angle), linearity: (half + radius) / trace };
}
// #endregion

function mediaMovil(t: readonly number[], y: readonly number[], windowS: number): number[] {
  const half = windowS / 2;
  const out: number[] = new Array(y.length);
  let from = 0;
  let to = 0;
  for (let i = 0; i < y.length; i += 1) {
    while (t[from] < t[i] - half) from += 1;
    while (to < y.length && t[to] <= t[i] + half) to += 1;
    let sum = 0;
    for (let k = from; k < to; k += 1) sum += y[k];
    out[i] = sum / (to - from);
  }
  return out;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function std(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// #region integracion
/**
 * Integra la aceleración para obtener velocidad y posición con la regla del
 * trapecio, partiendo del reposo (v = 0, x = 0):
 *   v_i = v_(i−1) + ½(a_(i−1) + a_i)·Δt
 *   x_i = x_(i−1) + ½(v_(i−1) + v_i)·Δt
 */
export function integrarMovimiento(t: readonly number[], a: readonly number[]): { v: number[]; x: number[] } {
  const v: number[] = [0];
  const x: number[] = [0];
  for (let i = 1; i < t.length; i += 1) {
    const dt = t[i] - t[i - 1];
    v.push(v[i - 1] + integrarTrapecio(a[i - 1], a[i], dt));
    x.push(x[i - 1] + integrarTrapecio(v[i - 1], v[i], dt));
  }
  return { v, x };
}
// #endregion

// #region ceroDeVelocidad
/**
 * Corrección por «velocidad cero» (ZUPT). El teléfono empieza y termina en
 * reposo, así que la velocidad final debería ser 0. Lo que sobra es deriva del
 * sensor, que crece de forma lineal con el tiempo; se resta esa rampa:
 *   v_corregida(t) = v(t) − v_final · (t − t₀)/(t_final − t₀)
 */
export function ceroDeVelocidad(t: readonly number[], v: readonly number[]): { v: number[]; drift: number } {
  const drift = v[v.length - 1];
  const span = t[t.length - 1] - t[0];
  if (!(span > 0)) return { v: [...v], drift };
  return { v: v.map((value, i) => value - (drift * (t[i] - t[0])) / span), drift };
}
// #endregion

type Prepared = {
  t: number[];
  dx: number[];
  dy: number[];
  rotationMax: number | null;
};

function preparar(samples: readonly MotionSample[], baseline: Baseline, config: MotionConfig): Prepared | { reason: string } {
  const t: number[] = [];
  const dx: number[] = [];
  const dy: number[] = [];
  let rotationMax: number | null = null;
  for (const sample of samples) {
    const delta = deltaEnPlano(sample, baseline);
    if (!delta) return { reason: "Faltan componentes de la aceleración en la grabación." };
    if (t.length > 0) {
      const gap = sample.tMs - samples[t.length - 1].tMs;
      if (gap <= 0) return { reason: "Las muestras llegaron desordenadas." };
      if (gap > config.maxGapMs) {
        return { reason: `Se perdieron muestras (hueco de ${Math.round(gap)} ms, máx. ${config.maxGapMs} ms). Repite la prueba.` };
      }
    }
    t.push((sample.tMs - samples[0].tMs) / 1000);
    dx.push(delta.x);
    dy.push(delta.y);
    const rotation = magnitudDeGiro(sample);
    if (rotation !== null) rotationMax = Math.max(rotationMax ?? 0, rotation);
  }
  return { t, dx, dy, rotationMax };
}

function decimar(t: readonly number[], series: { a: number[]; v: number[]; x: number[] }, onset: number, rateHz: number): MotionPoint[] {
  const points: MotionPoint[] = [];
  const step = 1 / rateHz;
  let lastKept = -Infinity;
  for (let i = 0; i < t.length; i += 1) {
    const rel = t[i] - t[onset];
    if (i === 0 || i === t.length - 1 || rel - lastKept >= step - 1e-9) {
      points.push({ t: round(rel), a: round(series.a[i]), v: round(series.v[i]), x: round(series.x[i]) });
      lastKept = rel;
    }
  }
  return points;
}

/**
 * Analiza una grabación completa: desde unos instantes en reposo, pasando por el
 * movimiento, hasta el reposo (MRU) o el final de la meseta (MRUA).
 */
export function analizarMovimiento(
  kind: MotionKind,
  baseline: Baseline,
  samples: readonly MotionSample[],
  config: MotionConfig = DEFAULT_MOTION_CONFIG,
): MotionAnalysisResult {
  if (samples.length < 10) return fail("La grabación es demasiado corta.");
  const prepared = preparar(samples, baseline, config);
  if ("reason" in prepared) return fail(prepared.reason);
  const { t, dx, dy, rotationMax } = prepared;
  const rateHz = frecuenciaDeMuestreo(samples.map((sample) => sample.tMs));
  if (rateHz === null || rateHz < config.minRateHz) {
    return fail(`Frecuencia de muestreo muy baja (${rateHz === null ? "?" : rateHz.toFixed(0)} Hz, mínimo ${config.minRateHz} Hz).`);
  }
  if (rotationMax !== null && rotationMax > config.rotationFail) {
    return fail(`El teléfono giró durante la prueba (${rotationMax.toFixed(0)} °/s). Apóyalo plano y sin girar.`);
  }
  const warnings: string[] = [];
  if (rateHz < config.warnRateHz) warnings.push(`Frecuencia de muestreo baja (${rateHz.toFixed(0)} Hz): la integración pierde exactitud.`);
  if (rotationMax !== null && rotationMax > config.rotationWarn) warnings.push(`El teléfono giró hasta ${rotationMax.toFixed(0)} °/s durante la prueba.`);
  if (baseline.source === "lineal") {
    warnings.push("El navegador no entregó la aceleración con gravedad: se usó la aceleración lineal, que el sistema filtra y puede distorsionar una aceleración sostenida.");
  }

  // Inicio del movimiento: primer instante con el vector de aceleración sobre el umbral.
  const threshold = umbralDeAceleracion(baseline, config);
  const windowS = config.smoothMs / 1000;
  const sx = mediaMovil(t, dx, windowS);
  const sy = mediaMovil(t, dy, windowS);
  const magnitude = sx.map((value, i) => Math.hypot(value, sy[i]));
  const onset = magnitude.findIndex((value) => value > threshold);
  if (onset < 0) return fail("No se detectó movimiento sobre el umbral de ruido.");
  const moving: { x: number; y: number }[] = [];
  for (let i = onset; i < t.length; i += 1) {
    if (magnitude[i] > threshold) moving.push({ x: dx[i], y: dy[i] });
  }
  if (moving.length < 5) return fail("El movimiento fue demasiado débil o breve para medirlo.");
  const axis = ejeDeMovimiento(moving);
  if (!axis) return fail("No se pudo determinar la dirección del movimiento.");

  // Signo: el arranque es el sentido positivo (los navegadores no coinciden en el signo de sus ejes).
  let start = 0;
  let count = 0;
  for (let i = onset; i < t.length && t[i] - t[onset] <= 0.15; i += 1) {
    start += dx[i] * axis.x + dy[i] * axis.y;
    count += 1;
  }
  const sign = count > 0 && start < 0 ? -1 : 1;
  const ux = axis.x * sign;
  const uy = axis.y * sign;
  const a = dx.map((value, i) => value * ux + dy[i] * uy);
  const aSmooth = mediaMovil(t, a, windowS);
  const raw = integrarMovimiento(t, a);

  if (kind === "mru") return analizarMru(baseline, config, { t, a, aSmooth, raw, onset, threshold, ux, uy, linearity: axis.linearity, rateHz, warnings });
  return analizarMrua(baseline, config, { t, a, aSmooth, raw, onset, threshold, ux, uy, linearity: axis.linearity, rateHz, warnings });
}

type Context = {
  t: number[];
  a: number[];
  aSmooth: number[];
  raw: { v: number[]; x: number[] };
  onset: number;
  threshold: number;
  ux: number;
  uy: number;
  linearity: number;
  rateHz: number;
  warnings: string[];
};

function analizarMru(baseline: Baseline, config: MotionConfig, ctx: Context): MotionAnalysisResult {
  const { t, a, aSmooth, onset, threshold, warnings } = ctx;
  const surface = comprobarSuperficie("mru", baseline, config);
  if (surface) return fail(surface);
  const n = t.length;
  // El teléfono debe terminar quieto: se exige calma en el último tramo.
  const lastQuiet = t[n - 1] - config.quietMs * 0.6 / 1000;
  for (let i = 0; i < n; i += 1) {
    if (t[i] >= lastQuiet && Math.abs(aSmooth[i]) > threshold) {
      return fail("La grabación no terminó con el teléfono en reposo: detén el carrito con la mano y espera medio segundo.");
    }
  }
  // Empujón y frenado: sin el lóbulo negativo del frenado no hay forma de saber dónde termina el crucero
  // (en crucero y en reposo la aceleración es igual de nula).
  const pushAt = aSmooth.findIndex((value, i) => i >= onset && value > threshold);
  if (pushAt < 0) return fail("No se detectó el empujón.");
  let brakeAt = -1;
  for (let i = n - 1; i > pushAt; i -= 1) {
    if (aSmooth[i] < -threshold) {
      brakeAt = i;
      break;
    }
  }
  if (brakeAt < 0) return fail("No se detectó el frenado. Detén el carrito con la mano para que la velocidad final sea 0.");
  const zero = ceroDeVelocidad(t, ctx.raw.v);
  const v = zero.v;
  const drift = zero.drift;
  const bias = drift / (t[n - 1] - t[0]);
  const aCorrected = a.map((value) => value - bias);
  const aSmoothCorrected = aSmooth.map((value) => value - bias);
  // x se vuelve a integrar con la velocidad corregida.
  const x: number[] = [0];
  for (let i = 1; i < n; i += 1) x.push(x[i - 1] + integrarTrapecio(v[i - 1], v[i], t[i] - t[i - 1]));
  const vPeak = Math.max(...v.map((value) => Math.abs(value)));
  if (vPeak < config.minPeakSpeed) {
    return fail(`La velocidad máxima (${vPeak.toFixed(2)} m/s) es demasiado baja. Empuja más fuerte.`);
  }
  const driftShare = Math.abs(drift) / vPeak;
  if (driftShare > config.maxDriftShare) {
    return fail(`La deriva del sensor (${(driftShare * 100).toFixed(0)} % de la velocidad máxima) es demasiado grande. Repite la prueba.`);
  }
  if (driftShare > config.warnDriftShare) {
    warnings.push(`Se corrigió una deriva del ${(driftShare * 100).toFixed(0)} % de la velocidad máxima: la velocidad es menos fiable.`);
  }

  // Crucero: la tanda de lecturas «quietas» más larga que va a velocidad alta, entre el empujón y el frenado.
  let best: { from: number; to: number } | null = null;
  let i = pushAt;
  while (i < brakeAt) {
    if (Math.abs(aSmoothCorrected[i]) >= threshold) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < brakeAt && Math.abs(aSmoothCorrected[j + 1]) < threshold) j += 1;
    const speed = mean(v.slice(i, j + 1));
    const duration = t[j] - t[i];
    if (speed >= config.cruiseSpeedShare * vPeak && (!best || duration > t[best.to] - t[best.from])) best = { from: i, to: j };
    i = j + 1;
  }
  if (!best || t[best.to] - t[best.from] < config.minCruiseMs / 1000) {
    return fail("No hay un tramo de crucero claro (aceleración casi nula a velocidad alta). Usa una superficie más lisa o un carrito con ruedas.");
  }
  const trim = config.fitTrimMs / 1000;
  const cruise: number[] = [];
  for (let k = best.from; k <= best.to; k += 1) {
    if (t[k] >= t[best.from] + trim && t[k] <= t[best.to] - trim) cruise.push(k);
  }
  if (cruise.length < 3) return fail("El tramo de crucero es demasiado corto para ajustarlo.");
  const origin = t[onset];
  const xOrigin = x[onset];
  const vs = cruise.map((k) => v[k]);
  const xFit = ajusteLineal(cruise.map((k) => t[k] - origin), cruise.map((k) => x[k] - xOrigin));
  if (!xFit) return fail("No se pudo ajustar la posición en el crucero.");
  const vCruise = mean(vs);
  const vVariation = vCruise !== 0 ? std(vs) / Math.abs(vCruise) : 0;
  const first = cruise[0];
  const last = cruise[cruise.length - 1];
  const shiftedX = x.map((value) => value - xOrigin);
  const series = decimar(t, { a: aCorrected, v, x: shiftedX }, onset, config.storedRateHz);
  const result: MruResult = {
    vCruise,
    vVariation,
    aCruise: mean(cruise.map((k) => aCorrected[k])),
    cruiseFromS: t[first] - origin,
    cruiseToS: t[last] - origin,
    cruiseDurationS: t[last] - t[first],
    xFit,
    cruiseDistance: x[last] - x[first],
    totalDistance: x[n - 1] - xOrigin,
    vPeak,
    driftRemoved: drift,
  };
  return {
    ok: true,
    analysis: {
      version: MOTION_CALC_VERSION,
      kind: "mru",
      source: baseline.source,
      rateHz: ctx.rateHz,
      durationS: t[n - 1] - origin,
      noise: baseline.noise,
      threshold,
      axis: { x: ctx.ux, y: ctx.uy },
      linearity: ctx.linearity,
      thetaDeg: baseline.thetaDeg,
      warnings,
      series,
      mru: result,
    },
  };
}

function analizarMrua(baseline: Baseline, config: MotionConfig, ctx: Context): MotionAnalysisResult {
  const { t, a, aSmooth, onset, threshold, warnings } = ctx;
  const surface = comprobarSuperficie("mrua", baseline, config);
  if (surface) return fail(surface);
  const theta = baseline.thetaDeg as number;
  const n = t.length;
  const origin = t[onset];
  const refFrom = origin + config.plateauRefFromMs / 1000;
  const refTo = origin + config.plateauRefToMs / 1000;
  const reference: number[] = [];
  for (let i = onset; i < n; i += 1) if (t[i] >= refFrom && t[i] <= refTo) reference.push(aSmooth[i]);
  if (reference.length < 3) return fail("La grabación termina demasiado pronto tras el inicio del movimiento.");
  const aRef = mean(reference);
  if (aRef < threshold) return fail("La aceleración al bajar es demasiado pequeña frente al ruido. Aumenta la inclinación de la rampa.");

  // Fin de la meseta: la aceleración se aleja de su valor de referencia (llegó abajo o chocó).
  let end = n - 1;
  for (let i = onset; i < n; i += 1) {
    if (t[i] <= refTo) continue;
    if (Math.abs(aSmooth[i] - aRef) > config.plateauTolerance * aRef) {
      end = i - 1;
      break;
    }
  }
  const trim = config.fitTrimMs / 1000;
  const window: number[] = [];
  for (let i = onset; i <= end; i += 1) if (t[i] >= origin + trim && t[i] <= t[end] - trim) window.push(i);
  if (window.length < 5 || t[window[window.length - 1]] - t[window[0]] < config.minWindowMs / 1000) {
    return fail(`El tramo de aceleración constante dura menos de ${config.minWindowMs} ms. Usa una rampa más larga o más suave.`);
  }
  const ts = window.map((i) => t[i] - origin);
  const as = window.map((i) => a[i]);
  const vs = window.map((i) => ctx.raw.v[i]);
  const xs = window.map((i) => ctx.raw.x[i] - ctx.raw.x[onset]);
  const vFit = ajusteLineal(ts, vs);
  const xFit = ajusteCuadratico(ts, xs);
  if (!vFit || !xFit) return fail("No se pudieron ajustar la velocidad y la posición.");
  const aMean = mean(as);
  const g = baseline.gravity as number;
  const theory = comparacionTeorica(theta, g, aMean);
  const mu = theory.mu;
  if (mu < -0.05) warnings.push("La aceleración medida supera a g·sen θ: revisa que la rampa no se haya movido y que el teléfono no se haya impulsado.");
  let alignment: number | null = null;
  const inPlane = Math.hypot(baseline.mean.x, baseline.mean.y);
  if (inPlane > 1e-6) {
    alignment = Math.abs((baseline.mean.x * ctx.ux + baseline.mean.y * ctx.uy) / inPlane);
    if (alignment < config.alignWarn) warnings.push("El teléfono no siguió la línea de máxima pendiente (se torció o lo empujaron de lado).");
  }
  const shiftedX = ctx.raw.x.map((value) => value - ctx.raw.x[onset]);
  const series = decimar(t, { a, v: ctx.raw.v, x: shiftedX }, onset, config.storedRateHz);
  const last = window[window.length - 1];
  const result: MruaResult = {
    thetaDeg: theta,
    gravity: g,
    aMean,
    aStd: std(as),
    aIdeal: theory.aIdeal,
    aDiff: theory.aDiff,
    aDiffPercent: theory.aDiffPercent,
    mu,
    windowFromS: ts[0],
    windowToS: ts[ts.length - 1],
    vFit,
    xFit,
    distance: ctx.raw.x[last] - ctx.raw.x[window[0]],
    totalDistance: ctx.raw.x[end] - ctx.raw.x[onset],
    vFinal: ctx.raw.v[last],
    alignment,
  };
  return {
    ok: true,
    analysis: {
      version: MOTION_CALC_VERSION,
      kind: "mrua",
      source: baseline.source,
      rateHz: ctx.rateHz,
      durationS: t[n - 1] - origin,
      noise: baseline.noise,
      threshold,
      axis: { x: ctx.ux, y: ctx.uy },
      linearity: ctx.linearity,
      thetaDeg: theta,
      warnings,
      series,
      mrua: result,
    },
  };
}
