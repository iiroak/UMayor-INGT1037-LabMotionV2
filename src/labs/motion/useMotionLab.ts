import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SensorController } from "../../hooks/useSensors";
import type { MotionSample } from "../../lib/sensors";
import {
  EMPTY_REST,
  captureView,
  createStream,
  failMachine,
  finishMachine,
  processSample,
  startMachine,
  stepMachine,
  tickMachine,
  type CaptureView,
  type LivePoint,
  type Machine,
  type StepOutcome,
} from "./motionCapture";
import { DEFAULT_MOTION_CONFIG, type MotionConfig, type MotionKind, type RestEvaluation } from "./motionPhysics";
import { applyTrial, isValidDistance, loadTrials, saveTrials, type MotionTrial } from "./motionSession";
import { DEFAULT_SIM, simulateAnalysis, type SimParams } from "./motionSimulation";

export type { CaptureView, LivePoint } from "./motionCapture";

/** Lo que muestra la demostración en vivo. */
export type MotionLive = {
  rest: RestEvaluation;
  history: LivePoint[];
  atMs: number;
  totalSamples: number;
  /** Inclinación de la superficie medida en reposo (°), si hay reposo. */
  thetaDeg: number | null;
};

export type MotionSection = "demo" | "science" | "results";

const UI_INTERVAL_MS = 80;

export function currentScreenOrientation(): string {
  if (typeof screen !== "undefined" && screen.orientation?.type) return screen.orientation.type;
  return "desconocida";
}

const EMPTY_LIVE: MotionLive = { rest: EMPTY_REST, history: [], atMs: 0, totalSamples: 0, thetaDeg: null };

/**
 * Estado de un laboratorio de movimiento (MRU o MRUA). Las pruebas guardadas se
 * cargan siempre (las tarjetas muestran el avance), pero el hook solo se suscribe a
 * las muestras del sensor mientras el laboratorio está abierto (`active`): al
 * cerrarlo se descarta la captura en curso.
 */
export function useMotionLab(kind: MotionKind, sensors: SensorController, active: boolean, config: MotionConfig = DEFAULT_MOTION_CONFIG) {
  const [trials, setTrials] = useState<MotionTrial[]>(() => loadTrials(kind));
  const [storageOk, setStorageOk] = useState(true);
  const [live, setLive] = useState<MotionLive>(EMPTY_LIVE);
  const [capture, setCapture] = useState<CaptureView>(() => captureView({ phase: "idle" }, 0, config));
  const [sim, setSim] = useState<{ enabled: boolean; params: SimParams }>({ enabled: false, params: DEFAULT_SIM });
  const [started, setStarted] = useState(false);
  const [section, setSection] = useState<MotionSection>("demo");

  const trialsRef = useRef(trials);
  trialsRef.current = trials;
  const streamRef = useRef(createStream());
  const machineRef = useRef<Machine>({ phase: "idle" });
  const lastUiRef = useRef(0);

  const publish = useCallback(
    (nowMs: number) => {
      lastUiRef.current = performance.now();
      const stream = streamRef.current;
      const rest = stream.rest;
      setLive({
        rest,
        history: stream.history.slice(),
        atMs: nowMs,
        totalSamples: stream.total,
        thetaDeg: rest.state === "rest" ? rest.baseline.thetaDeg : null,
      });
      setCapture(captureView(machineRef.current, nowMs, config));
    },
    [config],
  );

  const applyOutcome = useCallback(
    (outcome: StepOutcome, nowMs: number) => {
      const previous = machineRef.current;
      machineRef.current = outcome.machine;
      if (outcome.trial) {
        const replaceId = previous.phase === "resting" || previous.phase === "armed" || previous.phase === "recording" ? previous.replaceId : null;
        const next = applyTrial(trialsRef.current, outcome.trial, replaceId);
        trialsRef.current = next;
        setTrials(next);
      }
      if (outcome.changed) publish(nowMs);
    },
    [publish],
  );

  // Al abrir el laboratorio se parte de un flujo limpio; al cerrarlo se descarta la captura.
  useEffect(() => {
    streamRef.current = createStream();
    machineRef.current = { phase: "idle" };
    setLive(EMPTY_LIVE);
    setCapture(captureView({ phase: "idle" }, 0, config));
  }, [active, config]);

  const onSample = useCallback(
    (sample: MotionSample) => {
      const machine = machineRef.current;
      const baseline = machine.phase === "armed" || machine.phase === "recording" ? machine.baseline : null;
      processSample(streamRef.current, sample, baseline, config);
      applyOutcome(stepMachine(machineRef.current, sample, streamRef.current, config, trialsRef.current), sample.tMs);
      if (performance.now() - lastUiRef.current >= UI_INTERVAL_MS) publish(sample.tMs);
    },
    [applyOutcome, config, publish],
  );

  useEffect(() => {
    if (!active) return undefined;
    return sensors.subscribe(onSample);
  }, [active, sensors.subscribe, onSample]);

  // Sin eventos no hay muestras que hagan avanzar el estado: un reloj detecta esperas y pérdida de señal.
  const sensorsActive = sensors.state === "active";
  useEffect(() => {
    if (!active || !sensorsActive) return undefined;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const stream = streamRef.current;
      const outcome = tickMachine(machineRef.current, now, stream.lastSampleAt, config, trialsRef.current);
      applyOutcome(outcome, now);
      const stale = stream.lastSampleAt === null || now - stream.lastSampleAt > config.staleMs;
      if (stale && stream.rest.state !== "insufficient") {
        stream.rest = { state: "insufficient", reason: "Se perdió la señal del sensor.", n: 0 };
        publish(now);
      } else if (machineRef.current.phase !== "idle" && !outcome.changed) {
        publish(now);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [active, applyOutcome, config, publish, sensorsActive]);

  // Un cambio de orientación de pantalla invalida la prueba en curso.
  useEffect(() => {
    if (!active) return undefined;
    const onChange = () => {
      const machine = failMachine(machineRef.current, "La orientación de la pantalla cambió durante la prueba; repítela con la pantalla fija.");
      if (machine !== machineRef.current) applyOutcome({ machine, changed: true }, performance.now());
    };
    screen.orientation?.addEventListener?.("change", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      screen.orientation?.removeEventListener?.("change", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, [active, applyOutcome]);

  useEffect(() => {
    setStorageOk(saveTrials(kind, trials));
  }, [kind, trials]);

  const startCapture = useCallback(
    (replaceId: string | null = null): { ok: true } | { ok: false; reason: string } => {
      if (!active) return { ok: false, reason: "Abre el laboratorio antes de medir." };
      if (sensors.state !== "active") return { ok: false, reason: "Activa los sensores antes de medir." };
      if (sim.enabled) return { ok: false, reason: "Desactiva la simulación: solo se registran datos reales del sensor." };
      const now = performance.now();
      applyOutcome({ machine: startMachine(kind, replaceId, now, currentScreenOrientation()), changed: true }, now);
      return { ok: true };
    },
    [active, applyOutcome, kind, sensors.state, sim.enabled],
  );

  const finishCapture = useCallback(() => {
    applyOutcome(finishMachine(machineRef.current, config, trialsRef.current), performance.now());
  }, [applyOutcome, config]);

  const resetCapture = useCallback(() => {
    applyOutcome({ machine: { phase: "idle" }, changed: true }, performance.now());
  }, [applyOutcome]);

  const deleteTrial = useCallback((id: string) => {
    setTrials((current) => current.filter((trial) => trial.id !== id));
  }, []);

  const clearTrials = useCallback(() => setTrials([]), []);

  /** Registra (o borra, con null) la distancia medida con cinta. */
  const setReference = useCallback((id: string, referenceM: number | null) => {
    if (referenceM !== null && !isValidDistance(referenceM)) return;
    setTrials((current) => current.map((trial) => (trial.id === id ? { ...trial, referenceM } : trial)));
  }, []);

  const setSimEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled) applyOutcome({ machine: { phase: "idle" }, changed: true }, performance.now());
      setSim((current) => ({ ...current, enabled }));
    },
    [applyOutcome],
  );

  const setSimParams = useCallback((params: Partial<SimParams>) => {
    setSim((current) => ({ ...current, params: { ...current.params, ...params } }));
  }, []);

  const simAnalysis = useMemo(() => (sim.enabled ? simulateAnalysis(kind, sim.params) : null), [kind, sim.enabled, sim.params]);

  return {
    kind,
    config,
    active,
    started,
    setStarted,
    section,
    setSection,
    trials,
    storageOk,
    live,
    capture,
    startCapture,
    finishCapture,
    resetCapture,
    deleteTrial,
    clearTrials,
    setReference,
    sim,
    setSimEnabled,
    setSimParams,
    simAnalysis,
  };
}

export type MotionLab = ReturnType<typeof useMotionLab>;
