import { describe, expect, it } from "vitest";
import type { MotionSample } from "../../lib/sensors";
import {
  DEFAULT_MOTION_CONFIG,
  ajusteCuadratico,
  ajusteLineal,
  analizarMovimiento,
  ceroDeVelocidad,
  ejeDeMovimiento,
  evaluarReposo,
  integrarMovimiento,
  type Baseline,
  type MotionKind,
} from "./motionPhysics";
import { mruProfile, mruaProfile, syntheticMotion, type SyntheticOptions } from "./motionSynthetic";

const START = 10_000;
const LEAD_S = 1.6;

function baselineOf(samples: readonly MotionSample[]): Baseline {
  const rest = samples.filter((sample) => sample.tMs <= START + 1500);
  const result = evaluarReposo(rest, START + 1500);
  if (result.state !== "rest") throw new Error(`no hay reposo: ${result.reason}`);
  return result.baseline;
}

function run(kind: MotionKind, samples: MotionSample[], every = 1) {
  const baseline = baselineOf(samples);
  const recording = samples.filter((sample, i) => sample.tMs >= START + (LEAD_S - 0.3) * 1000 && i % every === 0);
  return analizarMovimiento(kind, baseline, recording);
}

function mrua(overrides: Partial<SyntheticOptions> = {}, profile = { a: 2, runS: 1.4 }) {
  return syntheticMotion({
    durationS: LEAD_S + profile.runS + 1.2,
    thetaDeg: 15,
    downhillDeg: 20,
    noise: 0.03,
    bias: { x: 0.04, y: -0.03, z: 0.05 },
    profile: mruaProfile({ a: profile.a, startS: LEAD_S, runS: profile.runS }),
    ...overrides,
  });
}

function mru(overrides: Partial<SyntheticOptions> = {}) {
  return syntheticMotion({
    durationS: LEAD_S + 0.4 + 1.5 + 0.3 + 1,
    thetaDeg: 0,
    motionDeg: 33,
    noise: 0.03,
    bias: { x: 0.03, y: -0.02, z: 0.04 },
    profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 1.5, brake: 4, startS: LEAD_S }),
    ...overrides,
  });
}

describe("ajustes por mínimos cuadrados", () => {
  it("ajusteLineal recupera pendiente, intercepto y R² de una recta exacta", () => {
    const t = [0, 1, 2, 3, 4];
    const fit = ajusteLineal(t, t.map((value) => 3 * value + 2));
    expect(fit?.slope).toBeCloseTo(3, 10);
    expect(fit?.intercept).toBeCloseTo(2, 10);
    expect(fit?.r2).toBeCloseTo(1, 10);
  });

  it("ajusteLineal da R² bajo con datos sin tendencia y null con tiempos iguales", () => {
    expect(ajusteLineal([0, 1, 2, 3], [1, -1, 1, -1])?.r2).toBeLessThan(0.3);
    expect(ajusteLineal([1, 1, 1], [1, 2, 3])).toBeNull();
    expect(ajusteLineal([1], [1])).toBeNull();
  });

  it("ajusteCuadratico recupera x = 1 + 2t + 3t² con tiempos desplazados", () => {
    const t = Array.from({ length: 30 }, (_, i) => 5 + i * 0.1);
    const fit = ajusteCuadratico(t, t.map((value) => 1 + 2 * value + 3 * value * value));
    expect(fit?.c0).toBeCloseTo(1, 6);
    expect(fit?.c1).toBeCloseTo(2, 6);
    expect(fit?.c2).toBeCloseTo(3, 6);
    expect(fit?.r2).toBeCloseTo(1, 10);
    expect(ajusteCuadratico([0, 1], [0, 1])).toBeNull();
  });
});

describe("integración y cero de velocidad", () => {
  it("a = 2 m/s² durante 1 s da v = 2 m/s y x = 1 m", () => {
    const t = Array.from({ length: 101 }, (_, i) => i / 100);
    const { v, x } = integrarMovimiento(t, t.map(() => 2));
    expect(v[100]).toBeCloseTo(2, 6);
    expect(x[100]).toBeCloseTo(1, 4);
  });

  it("ceroDeVelocidad resta una rampa lineal para que la velocidad final sea 0", () => {
    const t = [0, 1, 2, 3, 4];
    const zero = ceroDeVelocidad(t, [0, 1, 2, 3, 4]);
    expect(zero.drift).toBe(4);
    zero.v.forEach((value) => expect(value).toBeCloseTo(0, 10));
  });
});

describe("eje de movimiento", () => {
  it("encuentra la recta aunque los vectores apunten a uno u otro lado", () => {
    const angle = (37 * Math.PI) / 180;
    const vectors = [2, -3, 1.5, -1, 4].map((m) => ({ x: m * Math.cos(angle), y: m * Math.sin(angle) }));
    const axis = ejeDeMovimiento(vectors);
    expect(Math.abs(axis!.x * Math.cos(angle) + axis!.y * Math.sin(angle))).toBeCloseTo(1, 8);
    expect(axis!.linearity).toBeCloseTo(1, 8);
  });

  it("la linealidad baja cuando el movimiento no es una recta", () => {
    const axis = ejeDeMovimiento([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]);
    expect(axis!.linearity).toBeCloseTo(0.5, 8);
    expect(ejeDeMovimiento([])).toBeNull();
  });
});

describe("reposo y línea base", () => {
  it("un teléfono quieto en una rampa de 15° da la inclinación y el |g| correctos", () => {
    const samples = syntheticMotion({ durationS: 1.5, thetaDeg: 15, downhillDeg: 20, noise: 0.03, profile: () => 0 });
    const result = evaluarReposo(samples, samples[samples.length - 1].tMs);
    expect(result.state).toBe("rest");
    if (result.state !== "rest") return;
    expect(result.baseline.thetaDeg).toBeCloseTo(15, 0);
    expect(result.baseline.gravity).toBeCloseTo(9.81, 1);
    expect(result.baseline.source).toBe("con-gravedad");
  });

  it("se mueve → no hay reposo; con pocas muestras o señal vieja → insuficiente", () => {
    const shaking = syntheticMotion({ durationS: 1.5, noise: 0.6, profile: () => 0 });
    expect(evaluarReposo(shaking, shaking[shaking.length - 1].tMs).state).toBe("moving");
    const rotating = syntheticMotion({ durationS: 1.5, rotationRate: 30, profile: () => 0 });
    expect(evaluarReposo(rotating, rotating[rotating.length - 1].tMs).state).toBe("moving");
    const short = syntheticMotion({ durationS: 0.2, profile: () => 0 });
    expect(evaluarReposo(short, short[short.length - 1].tMs).state).toBe("insufficient");
    const still = syntheticMotion({ durationS: 1.5, profile: () => 0 });
    expect(evaluarReposo(still, still[still.length - 1].tMs + 5000).state).toBe("insufficient");
    expect(evaluarReposo([], 0).state).toBe("insufficient");
  });

  it("sin aceleración con gravedad usa la lineal y no mide la inclinación", () => {
    const samples = syntheticMotion({ durationS: 1.5, includeTotal: false, profile: () => 0 });
    const result = evaluarReposo(samples, samples[samples.length - 1].tMs);
    expect(result.state).toBe("rest");
    if (result.state !== "rest") return;
    expect(result.baseline.source).toBe("lineal");
    expect(result.baseline.thetaDeg).toBeNull();
  });

  it("un |g| fuera de rango no es una lectura confiable", () => {
    const samples = syntheticMotion({ durationS: 1.5, gravity: 3, profile: () => 0 });
    expect(evaluarReposo(samples, samples[samples.length - 1].tMs).state).toBe("insufficient");
  });
});

describe("MRUA: rampa inclinada", () => {
  it("recupera la aceleración, la velocidad y la posición de una bajada con a = 2 m/s²", () => {
    const result = run("mrua", mrua());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = result.analysis.mrua!;
    expect(r.thetaDeg).toBeCloseTo(15, 0);
    expect(r.aMean).toBeGreaterThan(2 * 0.95);
    expect(r.aMean).toBeLessThan(2 * 1.05);
    expect(r.vFit.slope).toBeGreaterThan(2 * 0.95);
    expect(r.vFit.slope).toBeLessThan(2 * 1.05);
    expect(r.vFit.r2).toBeGreaterThan(0.99);
    expect(2 * r.xFit.c2).toBeGreaterThan(2 * 0.93);
    expect(2 * r.xFit.c2).toBeLessThan(2 * 1.07);
    expect(r.xFit.r2).toBeGreaterThan(0.999);
    expect(result.analysis.series.length).toBeGreaterThan(20);
    expect(result.analysis.warnings).toEqual([]);
  });

  it("compara con g·sen θ y estima el coeficiente de roce", () => {
    const result = run("mrua", mrua());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = result.analysis.mrua!;
    expect(r.aIdeal).toBeCloseTo(9.81 * Math.sin((15 * Math.PI) / 180), 1);
    expect(r.aDiff).toBeCloseTo(r.aMean - r.aIdeal, 8);
    // a = g(sen θ − μ cos θ)  →  μ = (g sen θ − a) / (g cos θ)
    const expectedMu = (r.aIdeal - 2) / (9.81 * Math.cos((15 * Math.PI) / 180));
    expect(r.mu).toBeCloseTo(expectedMu, 1);
    expect(r.mu).toBeGreaterThan(0);
  });

  it("da el mismo resultado sin importar cómo se apoyó el teléfono ni el signo del navegador", () => {
    const reference = run("mrua", mrua({ downhillDeg: 0 }));
    expect(reference.ok).toBe(true);
    for (const downhillDeg of [37, 90, 180, 250]) {
      for (const gravitySign of [1, -1] as const) {
        const result = run("mrua", mrua({ downhillDeg, gravitySign }));
        expect(result.ok, `downhill ${downhillDeg}, signo ${gravitySign}`).toBe(true);
        if (!result.ok || !reference.ok) continue;
        expect(result.analysis.mrua!.aMean).toBeCloseTo(reference.analysis.mrua!.aMean, 1);
        expect(result.analysis.mrua!.alignment!).toBeGreaterThan(0.98);
      }
    }
  });

  it("avisa si el teléfono no siguió la línea de máxima pendiente", () => {
    const result = run("mrua", mrua({ downhillDeg: 20, motionDeg: 80 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.mrua!.alignment!).toBeLessThan(0.85);
    expect(result.analysis.warnings.join(" ")).toContain("máxima pendiente");
  });

  it("falla con una rampa casi horizontal, muy empinada o sin aceleración con gravedad", () => {
    const flat = run("mrua", mrua({ thetaDeg: 1 }));
    expect(flat.ok).toBe(false);
    if (!flat.ok) expect(flat.reason).toContain("horizontal");
    const steep = run("mrua", mrua({ thetaDeg: 70 }));
    expect(steep.ok).toBe(false);
    const noGravity = run("mrua", mrua({ includeTotal: false }));
    expect(noGravity.ok).toBe(false);
    if (!noGravity.ok) expect(noGravity.reason).toContain("gravedad");
  });

  it("falla si la meseta es demasiado corta o no hay movimiento", () => {
    const short = run("mrua", mrua({}, { a: 2, runS: 0.45 }));
    expect(short.ok).toBe(false);
    const still = run("mrua", syntheticMotion({ durationS: 4, thetaDeg: 15, noise: 0.03, profile: () => 0 }));
    expect(still.ok).toBe(false);
    if (!still.ok) expect(still.reason).toContain("movimiento");
  });

  it("una aceleración mayor que g·sen θ genera un aviso", () => {
    const result = run("mrua", mrua({ thetaDeg: 5 }, { a: 2, runS: 1.4 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.mrua!.mu).toBeLessThan(-0.05);
    expect(result.analysis.warnings.join(" ")).toContain("supera");
  });
});

describe("MRU: empujón, crucero y frenado", () => {
  it("recupera la velocidad de crucero y una posición lineal", () => {
    const result = run("mru", mru());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = result.analysis.mru!;
    // 2 m/s² durante 0,4 s → 0,8 m/s
    expect(r.vCruise).toBeGreaterThan(0.8 * 0.9);
    expect(r.vCruise).toBeLessThan(0.8 * 1.1);
    expect(r.vVariation).toBeLessThan(0.05);
    expect(Math.abs(r.aCruise)).toBeLessThan(0.15);
    expect(r.xFit.slope).toBeCloseTo(r.vCruise, 1);
    expect(r.xFit.r2).toBeGreaterThan(0.999);
    expect(r.cruiseDurationS).toBeGreaterThan(1);
    expect(r.cruiseDistance).toBeGreaterThan(0.8 * 1.0);
    expect(r.totalDistance).toBeGreaterThan(r.cruiseDistance);
    expect(result.analysis.series.at(-1)!.v).toBeCloseTo(0, 1);
  });

  it("da el mismo resultado girando el teléfono y con el signo del navegador invertido", () => {
    const reference = run("mru", mru({ motionDeg: 0 }));
    expect(reference.ok).toBe(true);
    for (const motionDeg of [37, 90, 180, 250]) {
      for (const gravitySign of [1, -1] as const) {
        const result = run("mru", mru({ motionDeg, gravitySign }));
        expect(result.ok, `dirección ${motionDeg}, signo ${gravitySign}`).toBe(true);
        if (!result.ok || !reference.ok) continue;
        expect(result.analysis.mru!.vCruise).toBeCloseTo(reference.analysis.mru!.vCruise, 1);
      }
    }
  });

  it("una fricción leve del carrito se refleja en la variación de velocidad", () => {
    const result = run("mru", mru({ profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 1.5, brake: 4, startS: LEAD_S, friction: 0.2 }) }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = result.analysis.mru!;
    expect(r.aCruise).toBeLessThan(-0.1);
    expect(r.aCruise).toBeGreaterThan(-0.3);
  });

  it("corrige la deriva del sensor con el cero de velocidad", () => {
    const result = run("mru", mru({ bias: { x: 0.12, y: 0.09, z: 0 } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // El sesgo lo absorbe la línea base: la deriva removida debe ser pequeña.
    expect(Math.abs(result.analysis.mru!.driftRemoved)).toBeLessThan(0.1);
  });

  it("funciona con la aceleración lineal y avisa de la fuente", () => {
    const result = run("mru", mru({ includeTotal: false }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.source).toBe("lineal");
    expect(result.analysis.warnings.join(" ")).toContain("aceleración lineal");
  });

  it("rechaza una superficie inclinada", () => {
    const result = run("mru", mru({ thetaDeg: 20, downhillDeg: 33 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("inclinada");
  });

  it("falla si no hay frenado o la grabación termina en pleno crucero", () => {
    const noBrake = run("mru", mru({ profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 5, brake: 4, startS: LEAD_S }), durationS: LEAD_S + 0.4 + 1.2 }));
    expect(noBrake.ok).toBe(false);
    if (!noBrake.ok) expect(noBrake.reason).toContain("frenado");
  });

  it("falla si el empujón es muy débil o no hay crucero", () => {
    const weak = run("mru", mru({ profile: mruProfile({ push: 1.5, pushS: 0.05, cruiseS: 1.5, brake: 2, startS: LEAD_S }) }));
    expect(weak.ok).toBe(false);
    const noCruise = run("mru", mru({ profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 0.1, brake: 4, startS: LEAD_S }) }));
    expect(noCruise.ok).toBe(false);
    if (!noCruise.ok) expect(noCruise.reason).toContain("crucero");
  });
});

describe("calidad de la grabación", () => {
  it("un hueco de más de 100 ms invalida la prueba en vez de acotarse en silencio", () => {
    const samples = mrua();
    const gapStart = samples.findIndex((sample) => sample.tMs > START + 2400);
    const gapped = samples.map((sample, i) => (i >= gapStart ? { ...sample, tMs: sample.tMs + 150 } : sample));
    const result = run("mrua", gapped);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("hueco");
  });

  it("una frecuencia de muestreo muy baja invalida y una moderada avisa", () => {
    const slow = run("mrua", mrua(), 6);
    expect(slow.ok).toBe(false);
    if (!slow.ok) expect(slow.reason).toContain("Frecuencia");
    const warn = run("mrua", mrua(), 3);
    expect(warn.ok).toBe(true);
    if (warn.ok) expect(warn.analysis.warnings.join(" ")).toContain("Frecuencia de muestreo baja");
  });

  it("el muestreo con jitter razonable sigue dando la aceleración correcta", () => {
    const result = run("mrua", mrua({ jitterMs: 4 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.analysis.mrua!.aMean).toBeGreaterThan(2 * 0.93);
    expect(result.analysis.mrua!.aMean).toBeLessThan(2 * 1.07);
  });

  it("un giro fuerte durante la prueba la invalida y uno moderado avisa", () => {
    const spinning = (rate: number) => (tS: number) => (tS > LEAD_S ? rate : 0);
    const fast = run("mrua", mrua({ rotationRate: spinning(150) }));
    expect(fast.ok).toBe(false);
    if (!fast.ok) expect(fast.reason).toContain("giró");
    const moderate = run("mrua", mrua({ rotationRate: spinning(45) }));
    expect(moderate.ok).toBe(true);
    if (moderate.ok) expect(moderate.analysis.warnings.join(" ")).toContain("giró");
  });

  it("la serie guardada no supera la frecuencia configurada", () => {
    const result = run("mrua", mrua());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { series } = result.analysis;
    const duration = series[series.length - 1].t - series[0].t;
    expect(series.length / duration).toBeLessThan(DEFAULT_MOTION_CONFIG.storedRateHz * 1.15);
  });
});
