import type { MotionSample } from "../../lib/sensors";
import { GRAVEDAD_REFERENCIA } from "../tilt/tiltPhysics";

/**
 * Señales SINTÉTICAS para probar las matemáticas y para la simulación de la
 * demostración. No son datos experimentales y nunca se presentan como tales.
 */

/** Aceleración a lo largo del eje de movimiento (m/s²) en función del tiempo (s). */
export type SyntheticProfile = (tS: number) => number;

export type SyntheticOptions = {
  startMs?: number;
  durationS: number;
  rateHz?: number;
  /** Variación aleatoria de cada instante de muestreo (ms, ±). */
  jitterMs?: number;
  /** Inclinación de la superficie respecto de la horizontal (°). */
  thetaDeg?: number;
  /** Ángulo, en el plano de la pantalla, hacia donde baja la pendiente (°). */
  downhillDeg?: number;
  /** Ángulo del eje de movimiento en el plano de la pantalla (°). Por defecto, el de la pendiente. */
  motionDeg?: number;
  /** -1 invierte el signo de la lectura con gravedad (como hacen algunos navegadores). */
  gravitySign?: 1 | -1;
  /** Desviación del ruido blanco de cada eje (m/s²). */
  noise?: number;
  /** Sesgo constante del sensor en cada eje (m/s²). */
  bias?: { x: number; y: number; z: number };
  /** Si es falso, no entrega la aceleración lineal. */
  includeLinear?: boolean;
  /** Si es falso, no entrega la aceleración con gravedad. */
  includeTotal?: boolean;
  /** Intensidad de |g|. */
  gravity?: number;
  /** Velocidad angular (°/s) en el giroscopio: constante o función del tiempo (s). */
  rotationRate?: number | ((tS: number) => number);
  seed?: number;
  profile: SyntheticProfile;
};

/** Generador pseudoaleatorio determinista (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido gaussiano con media 0 y desviación 1 (Box-Muller). */
function gaussian(random: () => number): number {
  const u = Math.max(random(), 1e-12);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Serie de muestras de un teléfono apoyado en una superficie inclinada que se mueve
 * a lo largo de una recta. La lectura con gravedad sigue la convención de Android:
 *   lectura = a_movimiento − g_vector
 * (en reposo, pantalla arriba, z = +g).
 */
export function syntheticMotion(options: SyntheticOptions): MotionSample[] {
  const {
    startMs = 10_000,
    durationS,
    rateHz = 60,
    jitterMs = 0,
    thetaDeg = 0,
    downhillDeg = 0,
    motionDeg = downhillDeg,
    gravitySign = 1,
    noise = 0,
    bias = { x: 0, y: 0, z: 0 },
    includeLinear = true,
    includeTotal = true,
    gravity = GRAVEDAD_REFERENCIA,
    rotationRate = 0,
    seed = 1,
    profile,
  } = options;
  const random = seededRandom(seed);
  const jitter = seededRandom(seed + 1000);
  const step = 1000 / rateHz;
  const theta = rad(thetaDeg);
  const down = { x: Math.cos(rad(downhillDeg)), y: Math.sin(rad(downhillDeg)) };
  const move = { x: Math.cos(rad(motionDeg)), y: Math.sin(rad(motionDeg)) };
  const samples: MotionSample[] = [];
  for (let k = 0; k * step <= durationS * 1000; k += 1) {
    const offset = k === 0 || k * step >= durationS * 1000 ? 0 : (jitter() * 2 - 1) * jitterMs;
    const tMs = startMs + k * step + offset;
    const a = profile((k * step) / 1000);
    const slope = gravity * Math.sin(theta);
    const noiseVector = () => ({ x: noise * gaussian(random), y: noise * gaussian(random), z: noise * gaussian(random) });
    const n1 = noiseVector();
    const n2 = noiseVector();
    const total = {
      x: gravitySign * (a * move.x - slope * down.x) + bias.x + n1.x,
      y: gravitySign * (a * move.y - slope * down.y) + bias.y + n1.y,
      z: gravitySign * gravity * Math.cos(theta) + bias.z + n1.z,
    };
    const linear = { x: a * move.x + n2.x, y: a * move.y + n2.y, z: n2.z };
    samples.push({
      tMs,
      accelerationIncludingGravity: includeTotal ? total : { x: null, y: null, z: null },
      acceleration: includeLinear ? linear : { x: null, y: null, z: null },
      rotationRate: { x: 0, y: 0, z: typeof rotationRate === "function" ? rotationRate((k * step) / 1000) : rotationRate },
      orientation: { x: null, y: null, z: null },
      intervalMs: step,
    });
  }
  return samples;
}

function smoothStep(t: number, from: number, rise: number): number {
  if (t <= from) return 0;
  if (t >= from + rise) return 1;
  return (t - from) / rise;
}

/**
 * Bajada por una rampa: reposo, aceleración constante `a`, choque abajo y reposo.
 * `runS` es la duración de la meseta.
 */
export function mruaProfile(options: { a: number; startS: number; runS: number; rampS?: number; impact?: boolean }): SyntheticProfile {
  const { a, startS, runS, rampS = 0.06, impact = true } = options;
  const endS = startS + runS;
  return (t) => {
    if (t < endS) return a * smoothStep(t, startS, rampS);
    if (impact && t < endS + 0.08) return -3 * a;
    return 0;
  };
}

/**
 * Empujón, crucero y frenado, de modo que la velocidad vuelve a 0:
 * empuja con `push` durante `pushS`, avanza `cruiseS` con una desaceleración
 * `friction` y frena con `brake` hasta detenerse.
 */
export function mruProfile(options: { push: number; pushS: number; cruiseS: number; brake: number; startS: number; friction?: number }): SyntheticProfile {
  const { push, pushS, cruiseS, brake, startS, friction = 0 } = options;
  const vPush = push * pushS;
  const vCruiseEnd = vPush - friction * cruiseS;
  const brakeS = vCruiseEnd / brake;
  const cruiseFrom = startS + pushS;
  const brakeFrom = cruiseFrom + cruiseS;
  return (t) => {
    if (t < startS) return 0;
    if (t < cruiseFrom) return push;
    if (t < brakeFrom) return -friction;
    if (t < brakeFrom + brakeS) return -brake;
    return 0;
  };
}
