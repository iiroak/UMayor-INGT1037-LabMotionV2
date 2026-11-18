import type { MotionSample } from "../../lib/sensors";
import {
  analizarMovimiento,
  comprobarSuperficie,
  deltaEnPlano,
  evaluarReposo,
  umbralDeAceleracion,
  type Baseline,
  type MotionConfig,
  type MotionKind,
  type RestEvaluation,
} from "./motionPhysics";
import { buildTrial, nextAttempt, type MotionTrial } from "./motionSession";

// ── Flujo de lecturas: ventana de reposo + historial para el gráfico ─────

export type LivePoint = { tMs: number; value: number };

export const EMPTY_REST: RestEvaluation = { state: "insufficient", reason: "Sin lecturas.", n: 0 };

export type MotionStream = {
  /** Muestras recientes (reposo y pre-grabación). */
  recent: MotionSample[];
  /** Intensidad de la aceleración en el plano de la pantalla (m/s²), para el gráfico. */
  history: LivePoint[];
  total: number;
  lastSampleAt: number | null;
  rest: RestEvaluation;
};

export function createStream(): MotionStream {
  return { recent: [], history: [], total: 0, lastSampleAt: null, rest: EMPTY_REST };
}

/**
 * Procesa UNA muestra. Con línea base (preparado o grabando), la intensidad es la
 * aceleración en el plano menos esa base; sin ella, la desviación respecto del
 * promedio de la última ventana. Muta `stream`.
 */
export function processSample(stream: MotionStream, sample: MotionSample, baseline: Baseline | null, config: MotionConfig): RestEvaluation {
  stream.total += 1;
  stream.lastSampleAt = sample.tMs;
  stream.recent.push(sample);
  const keepMs = Math.max(config.restWindowMs, config.preRollMs) + 500;
  while (stream.recent.length > 0 && sample.tMs - stream.recent[0].tMs > keepMs) stream.recent.shift();
  stream.rest = evaluarReposo(stream.recent, sample.tMs, config);
  let value: number | null = null;
  if (baseline) {
    const delta = deltaEnPlano(sample, baseline);
    if (delta) value = Math.hypot(delta.x, delta.y);
  } else {
    const window = stream.recent.filter((item) => item.tMs >= sample.tMs - config.restWindowMs);
    const own = sample.accelerationIncludingGravity;
    if (own.x !== null && own.y !== null) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const item of window) {
        const axis = item.accelerationIncludingGravity;
        if (axis.x === null || axis.y === null) continue;
        sx += axis.x;
        sy += axis.y;
        n += 1;
      }
      if (n > 0) value = Math.hypot(own.x - sx / n, own.y - sy / n);
    }
  }
  if (value !== null && Number.isFinite(value)) {
    stream.history.push({ tMs: sample.tMs, value });
    while (stream.history.length > 0 && sample.tMs - stream.history[0].tMs > config.historyMs) stream.history.shift();
  }
  return stream.rest;
}

// ── Máquina de captura de una prueba ───────────────────────────────────
//
//   reposo → preparado → grabando → listo | fallido
//
// - «reposo»: espera a que el teléfono quede quieto y fija la línea base.
// - «preparado»: espera el inicio del movimiento (el empujón o la suelta).
// - «grabando»: guarda las muestras hasta que el movimiento termina.

type Common = { kind: MotionKind; replaceId: string | null; orientation: string; message: string };

export type RestingMachine = Common & {
  phase: "resting";
  startedAt: number;
  /** Desde cuándo el reposo es estable y con el mismo promedio (null si aún no lo es). */
  holdSince: number | null;
  holdMean: { x: number; y: number } | null;
};
export type ArmedMachine = Common & { phase: "armed"; startedAt: number; armedAt: number; baseline: Baseline; threshold: number };
export type RecordingMachine = Common & {
  phase: "recording";
  startedAt: number;
  baseline: Baseline;
  threshold: number;
  onsetAt: number;
  samples: MotionSample[];
  /** Suma de los vectores de los primeros instantes: fija la dirección del arranque. */
  dirX: number;
  dirY: number;
  /** Aceleración suavizada a lo largo de esa dirección. */
  smooth: number;
  lastAt: number;
  pushSeen: boolean;
  brakeSeen: boolean;
  quietSince: number | null;
};

export type ActiveMachine = RestingMachine | ArmedMachine | RecordingMachine;

export type Machine =
  | { phase: "idle" }
  | ActiveMachine
  | { phase: "done"; kind: MotionKind; replaceId: string | null; trial: MotionTrial }
  | { phase: "failed"; kind: MotionKind; replaceId: string | null; message: string };

export type CapturePhase = Machine["phase"];

export type CaptureView = {
  phase: CapturePhase;
  kind: MotionKind | null;
  replaceId: string | null;
  elapsedMs: number;
  /** 0–1 durante la grabación (frente a la duración máxima). */
  progress: number;
  message: string;
  trial: MotionTrial | null;
  thetaDeg: number | null;
};

export type StepOutcome = {
  machine: Machine;
  /** true si cambió la fase (conviene refrescar la UI de inmediato). */
  changed: boolean;
  /** Prueba lista para guardar (reemplaza `replaceId` si existe). */
  trial?: MotionTrial;
};

const DIRECTION_MS = 150;
const SMOOTH_S = 0.05;

export function startMachine(kind: MotionKind, replaceId: string | null, nowMs: number, orientation: string): RestingMachine {
  return {
    phase: "resting",
    kind,
    replaceId,
    orientation,
    startedAt: nowMs,
    holdSince: null,
    holdMean: null,
    message: "Apoya el teléfono, con la pantalla hacia arriba, y no lo toques: midiendo el reposo…",
  };
}

export function failMachine(machine: Machine, message: string): Machine {
  if (machine.phase !== "resting" && machine.phase !== "armed" && machine.phase !== "recording") return machine;
  return { phase: "failed", kind: machine.kind, replaceId: machine.replaceId, message };
}

function isActive(machine: Machine): machine is ActiveMachine {
  return machine.phase === "resting" || machine.phase === "armed" || machine.phase === "recording";
}

const ARMED_MESSAGE: Record<MotionKind, string> = {
  mru: "Listo. Empuja el teléfono (sobre una superficie lisa o un carrito), suéltalo y, al final, deténlo con la mano.",
  mrua: "Listo. Suelta el teléfono para que baje por la rampa, sin empujarlo.",
};

function finalize(machine: RecordingMachine, config: MotionConfig, trials: readonly MotionTrial[]): StepOutcome {
  const result = analizarMovimiento(machine.kind, machine.baseline, machine.samples, config);
  if (!result.ok) return { machine: failMachine(machine, result.reason), changed: true };
  const replaced = machine.replaceId ? trials.find((trial) => trial.id === machine.replaceId) : undefined;
  const others = replaced ? trials.filter((trial) => trial.id !== replaced.id) : trials;
  const trial = buildTrial({
    kind: machine.kind,
    attempt: replaced ? replaced.attempt : nextAttempt(others),
    analysis: result.analysis,
    referenceM: replaced?.referenceM ?? null,
    screenOrientation: machine.orientation,
    config,
  });
  return { machine: { phase: "done", kind: machine.kind, replaceId: machine.replaceId, trial }, changed: true, trial };
}

/** Termina la grabación a petición del usuario («Terminar»). */
export function finishMachine(machine: Machine, config: MotionConfig, trials: readonly MotionTrial[]): StepOutcome {
  if (machine.phase !== "recording") return { machine, changed: false };
  return finalize(machine, config, trials);
}

/**
 * Avanza la captura con una muestra (el flujo ya la incorporó):
 * - reposo: cuando el teléfono está quieto, fija la línea base y queda preparado;
 * - preparado: el movimiento comienza cuando la aceleración supera el umbral;
 * - grabando: guarda la muestra y decide si el movimiento terminó.
 */
export function stepMachine(
  machine: Machine,
  sample: MotionSample,
  stream: MotionStream,
  config: MotionConfig,
  trials: readonly MotionTrial[],
): StepOutcome {
  if (!isActive(machine)) return { machine, changed: false };
  if (machine.phase === "resting") {
    if (sample.tMs - machine.startedAt < config.settleMs) return { machine, changed: false };
    if (stream.rest.state === "rest") {
      const baseline = stream.rest.baseline;
      const shifted = machine.holdMean !== null
        && Math.hypot(baseline.mean.x - machine.holdMean.x, baseline.mean.y - machine.holdMean.y) > Math.max(config.restShiftTolerance, 3 * baseline.noise);
      if (machine.holdSince === null || shifted) {
        return { machine: { ...machine, holdSince: sample.tMs, holdMean: { x: baseline.mean.x, y: baseline.mean.y } }, changed: false };
      }
      if (sample.tMs - machine.holdSince < config.restHoldMs) return { machine, changed: false };
      const surface = comprobarSuperficie(machine.kind, baseline, config);
      if (surface) return { machine: failMachine(machine, surface), changed: true };
      return {
        machine: {
          ...machine,
          phase: "armed",
          armedAt: sample.tMs,
          baseline,
          threshold: umbralDeAceleracion(baseline, config),
          message: ARMED_MESSAGE[machine.kind],
        },
        changed: true,
      };
    }
    const message = stream.rest.state === "moving" ? stream.rest.reason : "Midiendo el reposo…";
    const reset = machine.holdSince !== null;
    if (message === machine.message && !reset) return { machine, changed: false };
    return { machine: { ...machine, message, holdSince: null, holdMean: null }, changed: false };
  }

  if (machine.phase === "armed") {
    const delta = deltaEnPlano(sample, machine.baseline);
    if (!delta) return { machine, changed: false };
    if (Math.hypot(delta.x, delta.y) <= machine.threshold) return { machine, changed: false };
    const samples = stream.recent.filter((item) => item.tMs >= sample.tMs - config.preRollMs);
    const recording: RecordingMachine = {
      ...machine,
      phase: "recording",
      onsetAt: sample.tMs,
      samples,
      dirX: delta.x,
      dirY: delta.y,
      smooth: Math.hypot(delta.x, delta.y),
      lastAt: sample.tMs,
      pushSeen: false,
      brakeSeen: false,
      quietSince: null,
      message: machine.kind === "mru" ? "Grabando… detén el teléfono con la mano al final." : "Grabando…",
    };
    return { machine: recording, changed: true };
  }

  // grabando
  const delta = deltaEnPlano(sample, machine.baseline);
  const samples = [...machine.samples, sample];
  if (!delta) return { machine: { ...machine, samples }, changed: false };
  let { dirX, dirY } = machine;
  if (sample.tMs - machine.onsetAt <= DIRECTION_MS) {
    dirX += delta.x;
    dirY += delta.y;
  }
  const norm = Math.hypot(dirX, dirY) || 1;
  const along = (delta.x * dirX + delta.y * dirY) / norm;
  const dt = Math.max(0, (sample.tMs - machine.lastAt) / 1000);
  const alpha = 1 - Math.exp(-dt / SMOOTH_S);
  const smooth = machine.smooth + alpha * (along - machine.smooth);
  const pushSeen = machine.pushSeen || smooth > machine.threshold;
  const brakeSeen = machine.brakeSeen || (pushSeen && smooth < -machine.threshold);
  const quiet = Math.abs(smooth) < machine.threshold;
  const quietSince = quiet ? (machine.quietSince ?? sample.tMs) : null;
  const next: RecordingMachine = { ...machine, samples, dirX, dirY, smooth, lastAt: sample.tMs, pushSeen, brakeSeen, quietSince };
  const sinceOnset = sample.tMs - machine.onsetAt;
  const calm = quietSince !== null && sample.tMs - quietSince >= config.quietMs;
  const finished = machine.kind === "mru" ? brakeSeen && calm : sinceOnset >= config.plateauRefToMs + 100 && calm;
  if (finished || sinceOnset >= config.maxRecordMs) return finalize(next, config, trials);
  return { machine: next, changed: false };
}

/** Controles por reloj: tiempos de espera y pérdida de señal. */
export function tickMachine(
  machine: Machine,
  nowMs: number,
  lastSampleAt: number | null,
  config: MotionConfig,
  trials: readonly MotionTrial[],
): StepOutcome {
  if (!isActive(machine)) return { machine, changed: false };
  if (lastSampleAt !== null && nowMs - lastSampleAt > config.staleMs) {
    return { machine: failMachine(machine, "Se perdió la señal del sensor. Repite la prueba."), changed: true };
  }
  if (machine.phase === "resting" && nowMs - machine.startedAt > config.restTimeoutMs) {
    return { machine: failMachine(machine, "El teléfono no quedó quieto a tiempo. Apóyalo sin tocarlo y vuelve a intentar."), changed: true };
  }
  if (machine.phase === "armed" && nowMs - machine.armedAt > config.armTimeoutMs) {
    return {
      machine: failMachine(machine, machine.kind === "mru" ? "No se detectó movimiento. Empuja el teléfono con más fuerza." : "No se detectó movimiento. Aumenta la inclinación de la rampa o usa una superficie más lisa."),
      changed: true,
    };
  }
  if (machine.phase === "recording" && nowMs - machine.onsetAt >= config.maxRecordMs) return finalize(machine, config, trials);
  return { machine, changed: false };
}

export function captureView(machine: Machine, nowMs: number, config: MotionConfig): CaptureView {
  if (machine.phase === "idle") {
    return { phase: "idle", kind: null, replaceId: null, elapsedMs: 0, progress: 0, message: "", trial: null, thetaDeg: null };
  }
  if (machine.phase === "done") {
    return { phase: "done", kind: machine.kind, replaceId: machine.replaceId, elapsedMs: 0, progress: 1, message: "Prueba registrada.", trial: machine.trial, thetaDeg: machine.trial.analysis.thetaDeg };
  }
  if (machine.phase === "failed") {
    return { phase: "failed", kind: machine.kind, replaceId: machine.replaceId, elapsedMs: 0, progress: 0, message: machine.message, trial: null, thetaDeg: null };
  }
  const elapsedMs = machine.phase === "recording" ? nowMs - machine.onsetAt : nowMs - machine.startedAt;
  return {
    phase: machine.phase,
    kind: machine.kind,
    replaceId: machine.replaceId,
    elapsedMs,
    progress: machine.phase === "recording" ? Math.min(1, elapsedMs / config.maxRecordMs) : 0,
    message: machine.message,
    trial: null,
    thetaDeg: machine.phase === "resting" ? null : machine.baseline.thetaDeg,
  };
}

