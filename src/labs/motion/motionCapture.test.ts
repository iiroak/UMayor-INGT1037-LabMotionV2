import { describe, expect, it } from "vitest";
import type { MotionSample } from "../../lib/sensors";
import {
  captureView,
  createStream,
  failMachine,
  finishMachine,
  processSample,
  startMachine,
  stepMachine,
  tickMachine,
  type CapturePhase,
  type Machine,
} from "./motionCapture";
import { DEFAULT_MOTION_CONFIG, type MotionKind } from "./motionPhysics";
import { buildTrial, type MotionTrial } from "./motionSession";
import { mruProfile, mruaProfile, syntheticMotion, type SyntheticOptions } from "./motionSynthetic";

const CONFIG = DEFAULT_MOTION_CONFIG;
const LEAD_S = 2.8;

function mrua(overrides: Partial<SyntheticOptions> = {}) {
  return syntheticMotion({
    durationS: LEAD_S + 1.4 + 1.5,
    thetaDeg: 15,
    downhillDeg: 20,
    noise: 0.03,
    profile: mruaProfile({ a: 2, startS: LEAD_S, runS: 1.4 }),
    ...overrides,
  });
}

function mru(overrides: Partial<SyntheticOptions> = {}) {
  return syntheticMotion({
    durationS: LEAD_S + 0.4 + 1.5 + 0.3 + 1.5,
    motionDeg: 33,
    noise: 0.03,
    profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 1.5, brake: 4, startS: LEAD_S }),
    ...overrides,
  });
}

/** Alimenta la máquina con una serie completa, como lo haría el hook. */
function drive(kind: MotionKind, samples: readonly MotionSample[], trials: readonly MotionTrial[] = [], replaceId: string | null = null) {
  const stream = createStream();
  let machine: Machine = startMachine(kind, replaceId, samples[0].tMs, "portrait-primary");
  const phases: CapturePhase[] = [machine.phase];
  for (const sample of samples) {
    const baseline = machine.phase === "armed" || machine.phase === "recording" ? machine.baseline : null;
    processSample(stream, sample, baseline, CONFIG);
    machine = stepMachine(machine, sample, stream, CONFIG, trials).machine;
    if (phases[phases.length - 1] !== machine.phase) phases.push(machine.phase);
    if (machine.phase === "done" || machine.phase === "failed") break;
  }
  return { machine, phases, stream };
}

describe("flujo de lecturas", () => {
  it("la intensidad en vivo sube cuando el teléfono se mueve", () => {
    const samples = mrua();
    const stream = createStream();
    for (const sample of samples) processSample(stream, sample, null, CONFIG);
    const values = stream.history.map((point) => point.value);
    expect(values.length).toBeGreaterThan(50);
    expect(Math.max(...values)).toBeGreaterThan(0.5);
    expect(stream.total).toBe(samples.length);
  });

  it("conserva solo el historial configurado", () => {
    const stream = createStream();
    for (const sample of mrua({ durationS: 20, profile: () => 0 })) processSample(stream, sample, null, CONFIG);
    const span = stream.history[stream.history.length - 1].tMs - stream.history[0].tMs;
    expect(span).toBeLessThanOrEqual(CONFIG.historyMs);
  });
});

describe("captura completa", () => {
  it("MRUA: reposo → preparado → grabando → listo, con la aceleración correcta", () => {
    const { machine, phases } = drive("mrua", mrua());
    expect(phases).toEqual(["resting", "armed", "recording", "done"]);
    expect(machine.phase).toBe("done");
    if (machine.phase !== "done") return;
    expect(machine.trial.kind).toBe("mrua");
    expect(machine.trial.attempt).toBe(1);
    expect(machine.trial.analysis.mrua!.aMean).toBeGreaterThan(1.9);
    expect(machine.trial.analysis.mrua!.aMean).toBeLessThan(2.1);
    expect(machine.trial.quality).toBe("ok");
  });

  it("MRU: reposo → preparado → grabando → listo, con la velocidad correcta", () => {
    const { machine, phases } = drive("mru", mru());
    expect(phases).toEqual(["resting", "armed", "recording", "done"]);
    if (machine.phase !== "done") throw new Error(machine.phase === "failed" ? machine.message : "no terminó");
    expect(machine.trial.analysis.mru!.vCruise).toBeGreaterThan(0.72);
    expect(machine.trial.analysis.mru!.vCruise).toBeLessThan(0.88);
  });

  it("MRU: el crucero (aceleración nula) no se confunde con el final: espera el frenado", () => {
    const { machine } = drive("mru", mru({ profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 2.5, brake: 4, startS: LEAD_S }), durationS: LEAD_S + 0.4 + 2.5 + 0.3 + 1.5 }));
    expect(machine.phase).toBe("done");
    if (machine.phase !== "done") return;
    expect(machine.trial.analysis.mru!.cruiseDurationS).toBeGreaterThan(2);
  });

  it("la repetición de una prueba conserva su número de intento y su distancia de referencia", () => {
    const first = drive("mrua", mrua());
    if (first.machine.phase !== "done") throw new Error("no terminó");
    const original = buildTrial({ kind: "mrua", attempt: 2, analysis: first.machine.trial.analysis, referenceM: 1.5, screenOrientation: "x" });
    const again = drive("mrua", mrua(), [original], original.id);
    expect(again.machine.phase).toBe("done");
    if (again.machine.phase !== "done") return;
    expect(again.machine.trial.attempt).toBe(2);
    expect(again.machine.trial.referenceM).toBe(1.5);
  });
});

describe("fallos y esperas", () => {
  it("soltar el teléfono mientras se mide el reposo no deja una línea base falsa", () => {
    // Una aceleración constante de más de 1 s tiene poca varianza: sin el margen extra parecería reposo.
    const samples = mrua({ profile: mruaProfile({ a: 2, startS: 0.3, runS: 1.4 }), durationS: 7 });
    const { machine } = drive("mrua", samples);
    expect(machine.phase).not.toBe("done");
    if (machine.phase === "armed") expect(machine.baseline.thetaDeg).toBeCloseTo(15, 0);
  });

  it("una superficie inclinada falla un MRU en cuanto se mide el reposo", () => {
    const { machine } = drive("mru", mru({ thetaDeg: 25, downhillDeg: 33 }));
    expect(machine.phase).toBe("failed");
    if (machine.phase === "failed") expect(machine.message).toContain("inclinada");
  });

  it("una rampa casi horizontal falla un MRUA", () => {
    const { machine } = drive("mrua", mrua({ thetaDeg: 1 }));
    expect(machine.phase).toBe("failed");
    if (machine.phase === "failed") expect(machine.message).toContain("horizontal");
  });

  it("si el teléfono no queda quieto, sigue en reposo y el reloj lo abandona", () => {
    const shaking = syntheticMotion({ durationS: 4, noise: 0.6, profile: () => 0 });
    const { machine, stream } = drive("mru", shaking);
    expect(machine.phase).toBe("resting");
    if (machine.phase !== "resting") return;
    expect(machine.message).toContain("se mueve");
    const late = tickMachine(machine, machine.startedAt + CONFIG.restTimeoutMs + 1, stream.lastSampleAt, CONFIG, []);
    expect(late.machine.phase).toBe("failed");
  });

  it("preparado sin movimiento expira", () => {
    const rest = mrua({ profile: () => 0, durationS: 2 });
    const { machine } = drive("mrua", rest);
    expect(machine.phase).toBe("armed");
    if (machine.phase !== "armed") return;
    const last = rest[rest.length - 1].tMs;
    expect(tickMachine(machine, last + 100, last, CONFIG, []).machine.phase).toBe("armed");
    const expired = tickMachine(machine, machine.armedAt + CONFIG.armTimeoutMs + 1, machine.armedAt + CONFIG.armTimeoutMs, CONFIG, []);
    expect(expired.machine.phase).toBe("failed");
    if (expired.machine.phase === "failed") expect(expired.machine.message).toContain("No se detectó movimiento");
  });

  it("la pérdida de señal cancela la prueba", () => {
    const { machine } = drive("mrua", mrua({ profile: () => 0, durationS: 2 }));
    if (machine.phase !== "armed") throw new Error("no está preparado");
    const lost = tickMachine(machine, machine.armedAt + 5000, machine.armedAt + 100, CONFIG, []);
    expect(lost.machine.phase).toBe("failed");
    if (lost.machine.phase === "failed") expect(lost.machine.message).toContain("señal");
  });

  it("un MRU sin frenado termina al agotarse el tiempo y explica el motivo", () => {
    const samples = mru({ profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 30, brake: 4, startS: LEAD_S }), durationS: 14 });
    const { machine } = drive("mru", samples);
    expect(machine.phase).toBe("failed");
    if (machine.phase === "failed") expect(machine.message).toContain("frenado");
  });

  it("«Terminar» cierra la grabación; fuera de la grabación no hace nada", () => {
    const samples = mru();
    const stream = createStream();
    let machine: Machine = startMachine("mru", null, samples[0].tMs, "x");
    for (const sample of samples) {
      const baseline = machine.phase === "armed" || machine.phase === "recording" ? machine.baseline : null;
      processSample(stream, sample, baseline, CONFIG);
      machine = stepMachine(machine, sample, stream, CONFIG, []).machine;
      // justo después del frenado, antes de que pase la calma exigida
      if (machine.phase === "recording" && machine.brakeSeen && machine.quietSince !== null) break;
    }
    expect(machine.phase).toBe("recording");
    const finished = finishMachine(machine, CONFIG, []);
    expect(finished.changed).toBe(true);
    expect(["done", "failed"]).toContain(finished.machine.phase);
    expect(finishMachine({ phase: "idle" }, CONFIG, []).changed).toBe(false);
  });

  it("failMachine solo afecta a una captura activa", () => {
    expect(failMachine({ phase: "idle" }, "x")).toEqual({ phase: "idle" });
    const active = startMachine("mru", null, 0, "x");
    expect(failMachine(active, "motivo")).toMatchObject({ phase: "failed", message: "motivo", kind: "mru" });
  });
});

describe("vista de la captura", () => {
  it("resume cada fase para la interfaz", () => {
    expect(captureView({ phase: "idle" }, 0, CONFIG).phase).toBe("idle");
    const resting = startMachine("mrua", null, 1000, "x");
    const view = captureView(resting, 3000, CONFIG);
    expect(view).toMatchObject({ phase: "resting", kind: "mrua", elapsedMs: 2000, progress: 0 });
    const done = drive("mrua", mrua()).machine;
    const doneView = captureView(done, 0, CONFIG);
    expect(doneView.phase).toBe("done");
    expect(doneView.trial?.kind).toBe("mrua");
    expect(doneView.thetaDeg).toBeCloseTo(15, 0);
  });
});
