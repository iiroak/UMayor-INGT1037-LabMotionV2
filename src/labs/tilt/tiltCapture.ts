import type { MotionSample } from "../../lib/sensors";
import {
  evaluarEstabilidad,
  lecturaDeInclinacion,
  type Stability,
  type TiltConfig,
  type TiltReading,
  type TiltResult,
} from "./tiltPhysics";
import { buildTrial, nextAttempt, type TiltTrial } from "./tiltSession";

export type AnglePoint = { tMs: number; thetaDeg: number };

export const EMPTY_STABILITY: Stability = {
  state: "insufficient",
  reason: "Sin lecturas válidas.",
  n: 0,
  spanMs: 0,
  meanDeg: null,
  stdDeg: null,
  rangeDeg: null,
  meanLinear: null,
  maxRotation: null,
};

// ── Flujo de lecturas: ventana de estabilidad + historial ──────────────

export type TiltStream = {
  readings: TiltReading[];
  history: AnglePoint[];
  total: number;
  valid: number;
  lastSampleAt: number | null;
  lastResult: TiltResult | null;
  stability: Stability;
};

export function createStream(): TiltStream {
  return { readings: [], history: [], total: 0, valid: 0, lastSampleAt: null, lastResult: null, stability: EMPTY_STABILITY };
}

/** Procesa UNA muestra: lectura, ventana móvil, historial y estabilidad. Muta `stream`. */
export function processSample(stream: TiltStream, sample: MotionSample, config: TiltConfig): { result: TiltResult; stability: Stability } {
  const result = lecturaDeInclinacion(sample, config);
  stream.lastResult = result;
  stream.lastSampleAt = sample.tMs;
  stream.total += 1;
  if (result.ok) {
    stream.valid += 1;
    stream.readings.push(result.reading);
    while (stream.readings.length > 0 && sample.tMs - stream.readings[0].tMs > config.windowMs) stream.readings.shift();
    stream.history.push({ tMs: sample.tMs, thetaDeg: result.reading.thetaDeg });
    while (stream.history.length > 0 && sample.tMs - stream.history[0].tMs > config.historyMs) stream.history.shift();
  }
  const evaluated = evaluarEstabilidad(stream.readings, sample.tMs, config);
  stream.stability = result.ok ? evaluated : { ...evaluated, state: "insufficient", reason: result.detail };
  return { result, stability: stream.stability };
}

// ── Máquina de captura de una prueba ───────────────────────────────────

export type ActiveMachine = {
  phase: "waiting" | "capturing";
  referenceDeg: number;
  replaceId: string | null;
  waitStartedAt: number;
  captureStartedAt: number | null;
  restarts: number;
  samples: MotionSample[];
  readings: TiltReading[];
  orientation: string;
  message: string;
};

export type Machine =
  | { phase: "idle" }
  | ActiveMachine
  | { phase: "done"; referenceDeg: number; replaceId: string | null; restarts: number; trial: TiltTrial }
  | { phase: "failed"; referenceDeg: number; replaceId: string | null; restarts: number; message: string };

export type CapturePhase = Machine["phase"];

export type CaptureView = {
  phase: CapturePhase;
  referenceDeg: number | null;
  replaceId: string | null;
  progress: number;
  elapsedMs: number;
  restarts: number;
  message: string;
  trial: TiltTrial | null;
};

export type StepOutcome = {
  machine: Machine;
  /** true si cambió la fase (conviene refrescar la UI de inmediato). */
  changed: boolean;
  /** Prueba lista para guardar (reemplaza `replaceId` si existe). */
  trial?: TiltTrial;
};

export function startMachine(referenceDeg: number, replaceId: string | null, nowMs: number, orientation: string): ActiveMachine {
  return {
    phase: "waiting",
    referenceDeg,
    replaceId,
    waitStartedAt: nowMs,
    captureStartedAt: null,
    restarts: 0,
    samples: [],
    readings: [],
    orientation,
    message: "Esperando a que el teléfono quede quieto…",
  };
}

export function failMachine(machine: Machine, message: string): Machine {
  if (machine.phase !== "waiting" && machine.phase !== "capturing") return machine;
  return { phase: "failed", referenceDeg: machine.referenceDeg, replaceId: machine.replaceId, restarts: machine.restarts, message };
}

function isActive(machine: Machine): machine is ActiveMachine {
  return machine.phase === "waiting" || machine.phase === "capturing";
}

function finalize(machine: ActiveMachine, nowMs: number, config: TiltConfig, trials: readonly TiltTrial[]): StepOutcome {
  const replaced = machine.replaceId ? trials.find((trial) => trial.id === machine.replaceId) : undefined;
  const others = replaced ? trials.filter((trial) => trial.id !== replaced.id) : trials;
  const result = buildTrial({
    referenceDeg: machine.referenceDeg,
    attempt: replaced && replaced.referenceDeg === machine.referenceDeg ? replaced.attempt : nextAttempt(others, machine.referenceDeg),
    samples: machine.samples,
    readings: machine.readings,
    waitMs: (machine.captureStartedAt ?? nowMs) - machine.waitStartedAt,
    restarts: machine.restarts,
    screenOrientation: machine.orientation,
    config,
  });
  if (!result.ok) return { machine: failMachine(machine, result.reason), changed: true };
  return {
    machine: { phase: "done", referenceDeg: machine.referenceDeg, replaceId: machine.replaceId, restarts: machine.restarts, trial: result.trial },
    changed: true,
    trial: result.trial,
  };
}

/**
 * Avanza la captura con una muestra:
 * - esperando: pasa a capturar cuando la ventana móvil está «Estable»;
 * - capturando: cualquier movimiento o lectura inválida reinicia la ventana;
 * - al completar `captureMs` estables, construye la prueba.
 */
export function stepMachine(
  machine: Machine,
  sample: MotionSample,
  result: TiltResult,
  stability: Stability,
  config: TiltConfig,
  trials: readonly TiltTrial[],
): StepOutcome {
  if (!isActive(machine)) return { machine, changed: false };
  const now = sample.tMs;

  if (machine.phase === "waiting") {
    if (now - machine.waitStartedAt > config.waitTimeoutMs) {
      return { machine: failMachine(machine, `No se logró una lectura estable en ${Math.round(config.waitTimeoutMs / 1000)} s. Revisa que el soporte esté firme y no toques el teléfono.`), changed: true };
    }
    if (now - machine.waitStartedAt < config.settleMs) {
      return { machine: { ...machine, message: "Suelta el teléfono: esperando que se asiente tras el toque…" }, changed: false };
    }
    if (result.ok && stability.state === "stable") {
      return {
        machine: { ...machine, phase: "capturing", captureStartedAt: now, samples: [sample], readings: [result.reading], message: "Midiendo el intervalo estable…" },
        changed: true,
      };
    }
    const message = !result.ok ? result.detail : stability.state === "moving" ? "Esperando a que el teléfono quede quieto…" : stability.reason;
    return { machine: { ...machine, message }, changed: false };
  }

  if (!result.ok || stability.state !== "stable") {
    return {
      machine: {
        ...machine,
        phase: "waiting",
        captureStartedAt: null,
        samples: [],
        readings: [],
        restarts: machine.restarts + 1,
        message: !result.ok ? "Lectura no válida durante la medición; se reinicia la ventana." : "Se detectó movimiento; se reinicia la ventana estable.",
      },
      changed: true,
    };
  }

  const next: ActiveMachine = { ...machine, samples: [...machine.samples, sample], readings: [...machine.readings, result.reading] };
  if (next.captureStartedAt !== null && now - next.captureStartedAt >= config.captureMs) return finalize(next, now, config, trials);
  return { machine: next, changed: false };
}

/** Reloj sin muestras: detecta tiempo de espera agotado y señal perdida. */
export function tickMachine(machine: Machine, nowMs: number, lastSampleAt: number | null, config: TiltConfig): StepOutcome {
  if (!isActive(machine)) return { machine, changed: false };
  if (nowMs - machine.waitStartedAt > config.waitTimeoutMs) {
    return { machine: failMachine(machine, `No se logró una lectura estable en ${Math.round(config.waitTimeoutMs / 1000)} s.`), changed: true };
  }
  const silentMs = lastSampleAt === null ? nowMs - machine.waitStartedAt : nowMs - lastSampleAt;
  const lost = machine.phase === "capturing" ? silentMs > config.staleMs : silentMs > Math.max(2000, config.staleMs * 3);
  if (lost) {
    return { machine: failMachine(machine, "Se perdió la señal del sensor durante la medición. Mantén la página visible y vuelve a intentar."), changed: true };
  }
  return { machine, changed: false };
}

export function captureView(machine: Machine, nowMs: number, config: TiltConfig): CaptureView {
  if (machine.phase === "idle") {
    return { phase: "idle", referenceDeg: null, replaceId: null, progress: 0, elapsedMs: 0, restarts: 0, message: "", trial: null };
  }
  if (machine.phase === "done") {
    return { phase: "done", referenceDeg: machine.referenceDeg, replaceId: machine.replaceId, progress: 1, elapsedMs: machine.trial.durationMs, restarts: machine.restarts, message: "Prueba registrada.", trial: machine.trial };
  }
  if (machine.phase === "failed") {
    return { phase: "failed", referenceDeg: machine.referenceDeg, replaceId: machine.replaceId, progress: 0, elapsedMs: 0, restarts: machine.restarts, message: machine.message, trial: null };
  }
  const elapsedMs = machine.phase === "capturing" && machine.captureStartedAt !== null ? Math.max(0, nowMs - machine.captureStartedAt) : 0;
  return {
    phase: machine.phase,
    referenceDeg: machine.referenceDeg,
    replaceId: machine.replaceId,
    progress: machine.phase === "capturing" ? Math.min(1, elapsedMs / config.captureMs) : 0,
    elapsedMs,
    restarts: machine.restarts,
    message: machine.message,
    trial: null,
  };
}

/** Inserta la prueba nueva y quita la reemplazada, si corresponde. */
export function applyTrial(trials: readonly TiltTrial[], trial: TiltTrial, replaceId: string | null): TiltTrial[] {
  return [...trials.filter((item) => item.id !== replaceId), trial];
}
