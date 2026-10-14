import type { Axis, MotionSample } from "../../lib/sensors";
import { vectorSintetico } from "./tiltPhysics";

/**
 * Muestras SINTÉTICAS para probar las matemáticas. No son datos
 * experimentales y nunca se presentan como tales.
 */
export function syntheticSample(
  tMs: number,
  thetaDeg: number,
  options: { linear?: Axis | null; rotation?: Axis; noiseDeg?: number; magnitude?: number } = {},
): MotionSample {
  const linear = options.linear === undefined ? { x: 0, y: 0, z: 0 } : options.linear;
  const g = vectorSintetico(thetaDeg + (options.noiseDeg ?? 0), options.magnitude);
  const lin = linear ?? { x: null, y: null, z: null };
  return {
    tMs,
    // a_total = g + a_lineal
    accelerationIncludingGravity: {
      x: g.x + (lin.x ?? 0),
      y: g.y + (lin.y ?? 0),
      z: g.z + (lin.z ?? 0),
    },
    acceleration: lin,
    rotationRate: options.rotation ?? { x: 0, y: 0, z: 0 },
    orientation: { x: null, y: null, z: null },
    intervalMs: 16,
  };
}

/** Serie a ~60 Hz con ruido determinista (seno) de amplitud `noiseDeg`. */
export function syntheticSeries(startMs: number, durationMs: number, thetaDeg: number, noiseDeg = 0, stepMs = 1000 / 60): MotionSample[] {
  const samples: MotionSample[] = [];
  for (let t = 0; t <= durationMs; t += stepMs) {
    samples.push(syntheticSample(startMs + t, thetaDeg, { noiseDeg: noiseDeg * Math.sin(t / 37) }));
  }
  return samples;
}
