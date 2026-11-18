import { analizarMovimiento, evaluarReposo, type MotionAnalysis, type MotionKind } from "./motionPhysics";
import { mruProfile, mruaProfile, syntheticMotion } from "./motionSynthetic";

/**
 * Simulación para ensayar sin sensores: genera una señal sintética con ruido leve y la
 * pasa por EL MISMO análisis que una prueba real. Nunca se guarda ni se exporta.
 */
export type SimParams = {
  /** MRU: velocidad de crucero aproximada (m/s). */
  speed: number;
  /** MRU: desaceleración por roce durante el crucero (m/s²). */
  friction: number;
  /** MRUA: inclinación de la rampa (°). */
  thetaDeg: number;
  /** MRUA: coeficiente de roce cinético. */
  mu: number;
};

export const DEFAULT_SIM: SimParams = { speed: 0.8, friction: 0.05, thetaDeg: 15, mu: 0.05 };

const START = 10_000;
const LEAD_S = 1.6;

export function simulateAnalysis(kind: MotionKind, params: SimParams): MotionAnalysis | null {
  const g = 9.81;
  let samples;
  if (kind === "mru") {
    const push = 2;
    const pushS = Math.max(0.1, params.speed / push);
    samples = syntheticMotion({
      startMs: START,
      durationS: LEAD_S + pushS + 1.6 + 0.4 + 1.5,
      motionDeg: 30,
      noise: 0.02,
      seed: 7,
      profile: mruProfile({ push, pushS, cruiseS: 1.6, brake: 4, startS: LEAD_S, friction: params.friction }),
    });
  } else {
    const theta = (params.thetaDeg * Math.PI) / 180;
    const a = Math.max(0.3, g * (Math.sin(theta) - params.mu * Math.cos(theta)));
    samples = syntheticMotion({
      startMs: START,
      durationS: LEAD_S + 1.5 + 1.2,
      thetaDeg: params.thetaDeg,
      downhillDeg: 30,
      noise: 0.02,
      seed: 7,
      profile: mruaProfile({ a, startS: LEAD_S, runS: 1.5 }),
    });
  }
  const rest = evaluarReposo(samples.filter((sample) => sample.tMs <= START + 1500), START + 1500);
  if (rest.state !== "rest") return null;
  const result = analizarMovimiento(kind, rest.baseline, samples.filter((sample) => sample.tMs >= START + (LEAD_S - 0.3) * 1000));
  return result.ok ? result.analysis : null;
}
