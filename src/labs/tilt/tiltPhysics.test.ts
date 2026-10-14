import { describe, expect, it } from "vitest";
import type { MotionSample } from "../../lib/sensors";
import { syntheticSample, syntheticSeries } from "./testUtils";
import {
  DEFAULT_TILT_CONFIG,
  describirInclinacion,
  errorAbsoluto,
  errorPorcentual,
  estadisticas,
  evaluarEstabilidad,
  inclinacionDeSuperficie,
  lecturaDeInclinacion,
  vectorSintetico,
  type TiltReading,
} from "./tiltPhysics";

const G = 9.81;
const rad = (deg: number) => (deg * Math.PI) / 180;

function readingsOf(samples: MotionSample[]): TiltReading[] {
  return samples.flatMap((sample) => {
    const result = lecturaDeInclinacion(sample);
    return result.ok ? [result.reading] : [];
  });
}

describe("inclinacionDeSuperficie con vectores sintéticos (solo matemáticas)", () => {
  it.each([
    [0, { x: 0, y: 0, z: G }],
    [30, { x: G * Math.sin(rad(30)), y: 0, z: G * Math.cos(rad(30)) }],
    [45, { x: G * Math.sin(rad(45)), y: 0, z: G * Math.cos(rad(45)) }],
    [60, { x: G * Math.sin(rad(60)), y: 0, z: G * Math.cos(rad(60)) }],
    [90, { x: G, y: 0, z: 0 }],
  ])("%i° → θ ≈ %i°", (expected, vector) => {
    expect(inclinacionDeSuperficie(vector)).toBeCloseTo(expected, 10);
  });

  it("no depende del borde hacia el que se inclina ni del signo de gz", () => {
    const base = inclinacionDeSuperficie({ x: 4, y: 0, z: 9 });
    expect(inclinacionDeSuperficie({ x: -4, y: 0, z: 9 })).toBeCloseTo(base!, 12);
    expect(inclinacionDeSuperficie({ x: 0, y: 4, z: 9 })).toBeCloseTo(base!, 12);
    expect(inclinacionDeSuperficie({ x: 4, y: 0, z: -9 })).toBeCloseTo(base!, 12);
  });

  it("reparte la inclinación entre X e Y", () => {
    const v = vectorSintetico(30);
    const split = { x: v.x / Math.SQRT2, y: v.x / Math.SQRT2, z: v.z };
    expect(inclinacionDeSuperficie(split)).toBeCloseTo(30, 10);
  });

  it("se mantiene en 0–90° y es estable cerca de los extremos", () => {
    expect(inclinacionDeSuperficie({ x: 1e-9, y: 0, z: G })).toBeGreaterThanOrEqual(0);
    expect(inclinacionDeSuperficie({ x: G, y: 0, z: 1e-12 })).toBeLessThanOrEqual(90);
    expect(inclinacionDeSuperficie({ x: G, y: 0, z: 1e-12 })).toBeCloseTo(90, 6);
  });

  it("devuelve null con vector nulo o no finito (nunca un 0° falso)", () => {
    expect(inclinacionDeSuperficie({ x: 0, y: 0, z: 0 })).toBeNull();
    expect(inclinacionDeSuperficie({ x: Number.NaN, y: 0, z: G })).toBeNull();
    expect(inclinacionDeSuperficie({ x: Infinity, y: 0, z: G })).toBeNull();
  });
});

describe("lecturaDeInclinacion", () => {
  it("usa g = a_total − a_lineal cuando hay ambas lecturas", () => {
    const sample = syntheticSample(0, 45, { linear: { x: 0.5, y: -0.2, z: 0.1 } });
    const result = lecturaDeInclinacion(sample);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reading.mode).toBe("diferencia");
    expect(result.reading.thetaDeg).toBeCloseTo(45, 10);
    expect(result.reading.gravityMagnitude).toBeCloseTo(G, 10);
    expect(result.reading.linearMagnitude).toBeCloseTo(Math.hypot(0.5, -0.2, 0.1), 10);
  });

  it("usa a_total como «estimación en reposo» si falta la aceleración lineal", () => {
    const result = lecturaDeInclinacion(syntheticSample(0, 30, { linear: null }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.reading.mode).toBe("reposo");
      expect(result.reading.aLinear).toBeNull();
      expect(result.reading.thetaDeg).toBeCloseTo(30, 10);
    }
  });

  it("aceleración lineal incompleta también cae a modo reposo", () => {
    const sample = syntheticSample(0, 30, { linear: { x: 0, y: null, z: 0 } });
    const result = lecturaDeInclinacion(sample);
    expect(result.ok && result.reading.mode).toBe("reposo");
  });

  it("rechaza muestras sin aceleración con gravedad", () => {
    const sample: MotionSample = { ...syntheticSample(0, 0), accelerationIncludingGravity: { x: null, y: null, z: null } };
    const result = lecturaDeInclinacion(sample);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("sin-datos");
  });

  it("rechaza componentes incompletas", () => {
    const sample: MotionSample = { ...syntheticSample(0, 0), accelerationIncludingGravity: { x: 0, y: null, z: 9.8 } };
    const result = lecturaDeInclinacion(sample);
    expect(!result.ok && result.reason).toBe("componentes-incompletos");
  });

  it("rechaza amplitudes inválidas de |g|", () => {
    const tooSmall = lecturaDeInclinacion(syntheticSample(0, 30, { magnitude: 2 }));
    const tooLarge = lecturaDeInclinacion(syntheticSample(0, 30, { magnitude: 25 }));
    expect(!tooSmall.ok && tooSmall.reason).toBe("amplitud-invalida");
    expect(!tooLarge.ok && tooLarge.reason).toBe("amplitud-invalida");
    const zero = lecturaDeInclinacion({ ...syntheticSample(0, 0), accelerationIncludingGravity: { x: 0, y: 0, z: 0 } });
    expect(zero.ok).toBe(false);
  });
});

describe("estadísticas y errores", () => {
  it("calcula media, desviación muestral y rango", () => {
    const stats = estadisticas([29, 30, 31]);
    expect(stats?.mean).toBeCloseTo(30, 12);
    expect(stats?.std).toBeCloseTo(1, 12);
    expect(stats?.range).toBe(2);
    expect(stats?.min).toBe(29);
    expect(stats?.max).toBe(31);
  });

  it("no inventa dispersión con una sola muestra ni media sin datos", () => {
    expect(estadisticas([12])?.std).toBeNull();
    expect(estadisticas([])).toBeNull();
    expect(estadisticas([Number.NaN])).toBeNull();
  });

  it("error absoluto y porcentual", () => {
    expect(errorAbsoluto(32.75, 30)).toBeCloseTo(2.75, 12);
    expect(errorAbsoluto(28, 30)).toBe(2);
    expect(errorPorcentual(31.5, 30)).toBeCloseTo(5, 12);
  });

  it("con referencia 0° el error porcentual no aplica (sin división por cero)", () => {
    expect(errorPorcentual(0.4, 0)).toBeNull();
    expect(errorAbsoluto(0.4, 0)).toBeCloseTo(0.4, 12);
  });
});

describe("evaluarEstabilidad", () => {
  const cfg = DEFAULT_TILT_CONFIG;

  it("marca estable una ventana quieta con ruido pequeño", () => {
    const samples = syntheticSeries(0, 1500, 30, 0.05);
    const stability = evaluarEstabilidad(readingsOf(samples), samples[samples.length - 1].tMs, cfg);
    expect(stability.state).toBe("stable");
    expect(stability.meanDeg).toBeCloseTo(30, 1);
  });

  it("marca movimiento si el ángulo varía", () => {
    const samples = Array.from({ length: 90 }, (_, index) => syntheticSample(index * 16, 20 + index * 0.2));
    const stability = evaluarEstabilidad(readingsOf(samples), samples[samples.length - 1].tMs, cfg);
    expect(stability.state).toBe("moving");
  });

  it("marca movimiento por aceleración lineal aunque el ángulo no cambie", () => {
    const samples = Array.from({ length: 90 }, (_, index) => syntheticSample(index * 16, 30, { linear: { x: 0.8, y: 0, z: 0 } }));
    const stability = evaluarEstabilidad(readingsOf(samples), samples[samples.length - 1].tMs, cfg);
    expect(stability.state).toBe("moving");
    expect(stability.reason).toMatch(/Aceleración lineal/);
  });

  it("marca movimiento por giro (giroscopio solo como detector)", () => {
    const samples = Array.from({ length: 90 }, (_, index) => syntheticSample(index * 16, 30, { rotation: { x: 20, y: 0, z: 0 } }));
    const stability = evaluarEstabilidad(readingsOf(samples), samples[samples.length - 1].tMs, cfg);
    expect(stability.state).toBe("moving");
    expect(stability.reason).toMatch(/Giro/);
  });

  it("señal insuficiente con pocas muestras o ventana sin cubrir", () => {
    const few = syntheticSeries(0, 60, 30);
    expect(evaluarEstabilidad(readingsOf(few), few[few.length - 1].tMs, cfg).state).toBe("insufficient");
    expect(evaluarEstabilidad([], 1000, cfg).state).toBe("insufficient");
  });

  it("señal insuficiente si las lecturas quedaron viejas (señal perdida)", () => {
    const samples = syntheticSeries(0, 1500, 30);
    const stability = evaluarEstabilidad(readingsOf(samples), samples[samples.length - 1].tMs + cfg.staleMs + 50, cfg);
    expect(stability.state).toBe("insufficient");
    expect(stability.reason).toMatch(/perdió/);
  });

  it("solo considera la ventana reciente: un movimiento antiguo ya no cuenta", () => {
    const moving = Array.from({ length: 60 }, (_, index) => syntheticSample(index * 16, 10 + index));
    const still = syntheticSeries(2000, 1500, 45, 0.02);
    const all = readingsOf([...moving, ...still]);
    expect(evaluarEstabilidad(all, still[still.length - 1].tMs, cfg).state).toBe("stable");
  });

  it("los umbrales son configurables", () => {
    const samples = syntheticSeries(0, 1500, 30, 0.4);
    const strict = { ...cfg, maxStdDeg: 0.05, maxRangeDeg: 0.1 };
    expect(evaluarEstabilidad(readingsOf(samples), samples[samples.length - 1].tMs, strict).state).toBe("moving");
  });
});

describe("textos de la demostración", () => {
  it("describe cada estado sin inventar lecturas", () => {
    expect(describirInclinacion(null, "stable")).toBe("No hay lectura confiable");
    expect(describirInclinacion(30, "moving")).toMatch(/quieto/);
    expect(describirInclinacion(0.8, "stable")).toBe("Está casi horizontal");
    expect(describirInclinacion(32.7, "stable")).toBe("El teléfono está inclinado");
    expect(describirInclinacion(89.5, "stable")).toBe("Está casi vertical");
  });
});
