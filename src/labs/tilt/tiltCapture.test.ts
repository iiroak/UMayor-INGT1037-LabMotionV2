import { describe, expect, it } from "vitest";
import type { MotionSample } from "../../lib/sensors";
import { syntheticSample, syntheticSeries } from "./testUtils";
import {
  applyTrial,
  captureView,
  createStream,
  failMachine,
  processSample,
  startMachine,
  stepMachine,
  tickMachine,
  type Machine,
} from "./tiltCapture";
import { DEFAULT_TILT_CONFIG } from "./tiltPhysics";
import type { TiltTrial } from "./tiltSession";

const cfg = DEFAULT_TILT_CONFIG;

/** Alimenta la máquina con muestras, como lo hace el hook en cada evento. */
function run(samples: MotionSample[], machine: Machine, trials: TiltTrial[] = []) {
  const stream = createStream();
  let current = machine;
  let trial: TiltTrial | undefined;
  const phases: string[] = [];
  for (const sample of samples) {
    const { result, stability } = processSample(stream, sample, cfg);
    const outcome = stepMachine(current, sample, result, stability, cfg, trials);
    current = outcome.machine;
    if (outcome.trial) trial = outcome.trial;
    if (phases[phases.length - 1] !== current.phase) phases.push(current.phase);
  }
  return { machine: current, trial, phases, stream };
}

describe("captura de una prueba (muestras sintéticas)", () => {
  it("espera estabilidad, promedia la ventana y registra la prueba", () => {
    // 0,5 s moviéndose hacia 30°, luego quieto con ruido pequeño.
    const moving = Array.from({ length: 30 }, (_, index) => syntheticSample(index * 16, index));
    const still = syntheticSeries(500, 4000, 30, 0.05);
    const { machine, trial, phases } = run([...moving, ...still], startMachine(30, null, 0, "portrait-primary"));
    expect(phases).toEqual(["waiting", "capturing", "done"]);
    expect(machine.phase).toBe("done");
    expect(trial).toBeDefined();
    expect(trial!.meanDeg).toBeCloseTo(30, 1);
    expect(trial!.referenceDeg).toBe(30);
    expect(trial!.attempt).toBe(1);
    expect(trial!.durationMs).toBeGreaterThanOrEqual(cfg.captureMs);
    expect(trial!.waitMs).toBeGreaterThan(0);
    // Solo se guardan las muestras de la ventana estable, no las del movimiento.
    expect(trial!.samples[0].tMs).toBeGreaterThanOrEqual(500);
  });

  it("descarta el instante del toque: no captura antes de settleMs aunque ya esté quieto", () => {
    const { trial } = run(syntheticSeries(0, 5000, 20, 0.02), startMachine(20, null, 0, "p"));
    expect(trial!.samples[0].tMs).toBeGreaterThanOrEqual(cfg.settleMs);
    expect(trial!.waitMs).toBeGreaterThanOrEqual(cfg.settleMs);
  });

  it("un movimiento durante la medición reinicia la ventana", () => {
    const still1 = syntheticSeries(0, 2000, 30, 0.02);
    const bump = Array.from({ length: 20 }, (_, index) => syntheticSample(2010 + index * 16, 30 + 6 * Math.sin(index)));
    const still2 = syntheticSeries(2400, 5000, 31, 0.02);
    const { trial, machine } = run([...still1, ...bump, ...still2], startMachine(30, null, 0, "p"));
    expect(machine.phase).toBe("done");
    expect(trial!.restarts).toBeGreaterThanOrEqual(1);
    expect(trial!.warnings.join(" ")).toMatch(/reinició/);
    // El promedio corresponde a la segunda zona quieta, no a la mezcla.
    expect(trial!.meanDeg).toBeCloseTo(31, 1);
  });

  it("sin lecturas válidas nunca registra una prueba", () => {
    const invalid = Array.from({ length: 400 }, (_, index) => ({ ...syntheticSample(index * 16, 30), accelerationIncludingGravity: { x: null, y: null, z: null } }));
    const { machine, trial } = run(invalid, startMachine(30, null, 0, "p"));
    expect(trial).toBeUndefined();
    expect(machine.phase).toBe("waiting");
  });

  it("falla si no se logra estabilidad antes del tiempo máximo", () => {
    const shaking = Array.from({ length: Math.ceil((cfg.waitTimeoutMs + 1000) / 16) }, (_, index) => syntheticSample(index * 16, 30 + 5 * Math.sin(index / 2)));
    const { machine, trial } = run(shaking, startMachine(30, null, 0, "p"));
    expect(trial).toBeUndefined();
    expect(machine.phase).toBe("failed");
  });

  it("el reloj detecta la señal perdida durante la medición", () => {
    const { machine, stream } = run(syntheticSeries(0, 1500, 30), startMachine(30, null, 0, "p"));
    expect(machine.phase).toBe("capturing");
    const outcome = tickMachine(machine, stream.lastSampleAt! + cfg.staleMs + 10, stream.lastSampleAt, cfg);
    expect(outcome.machine.phase).toBe("failed");
    expect(outcome.changed).toBe(true);
  });

  it("el reloj no falla mientras siguen llegando muestras", () => {
    const { machine, stream } = run(syntheticSeries(0, 1500, 30), startMachine(30, null, 0, "p"));
    expect(tickMachine(machine, stream.lastSampleAt! + 50, stream.lastSampleAt, cfg).machine.phase).toBe("capturing");
  });

  it("numera la prueba según las existentes y respeta el reemplazo", () => {
    const first = run(syntheticSeries(0, 4000, 45, 0.02), startMachine(45, null, 0, "p")).trial!;
    const second = run(syntheticSeries(0, 4000, 45.5, 0.02), startMachine(45, null, 0, "p"), [first]).trial!;
    expect(second.attempt).toBe(2);
    const replacement = run(syntheticSeries(0, 4000, 44.8, 0.02), startMachine(45, first.id, 0, "p"), [first, second]).trial!;
    expect(replacement.attempt).toBe(1);
    const updated = applyTrial([first, second], replacement, first.id);
    expect(updated.map((trial) => trial.id)).toEqual([second.id, replacement.id]);
  });

  it("vista de progreso y fallo explícito", () => {
    const capturing = run(syntheticSeries(0, 2000, 30), startMachine(30, null, 0, "p")).machine;
    const view = captureView(capturing, 2000, cfg);
    expect(view.phase).toBe("capturing");
    expect(view.progress).toBeGreaterThan(0);
    expect(view.progress).toBeLessThanOrEqual(1);
    const failed = failMachine(capturing, "La orientación cambió");
    expect(captureView(failed, 0, cfg)).toMatchObject({ phase: "failed", message: "La orientación cambió" });
    expect(failMachine({ phase: "idle" }, "x")).toEqual({ phase: "idle" });
  });
});

describe("flujo de lecturas", () => {
  it("mantiene solo la ventana y el historial configurados", () => {
    const stream = createStream();
    for (const sample of syntheticSeries(0, cfg.historyMs + 3000, 20)) processSample(stream, sample, cfg);
    const span = stream.readings[stream.readings.length - 1].tMs - stream.readings[0].tMs;
    expect(span).toBeLessThanOrEqual(cfg.windowMs);
    const historySpan = stream.history[stream.history.length - 1].tMs - stream.history[0].tMs;
    expect(historySpan).toBeLessThanOrEqual(cfg.historyMs);
    expect(stream.valid).toBe(stream.total);
  });

  it("una muestra inválida deja la estabilidad en «señal insuficiente»", () => {
    const stream = createStream();
    for (const sample of syntheticSeries(0, 1500, 20)) processSample(stream, sample, cfg);
    expect(stream.stability.state).toBe("stable");
    processSample(stream, { ...syntheticSample(1600, 20), accelerationIncludingGravity: { x: null, y: null, z: null } }, cfg);
    expect(stream.stability.state).toBe("insufficient");
    expect(stream.lastResult?.ok).toBe(false);
  });
});
