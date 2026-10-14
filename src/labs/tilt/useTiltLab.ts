import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SensorController } from "../../hooks/useSensors";
import type { MotionSample } from "../../lib/sensors";
import {
  EMPTY_STABILITY,
  applyTrial,
  captureView,
  createStream,
  failMachine,
  processSample,
  startMachine,
  stepMachine,
  tickMachine,
  type AnglePoint,
  type CaptureView,
  type Machine,
  type StepOutcome,
} from "./tiltCapture";
import { DEFAULT_TILT_CONFIG, lecturaDeInclinacion, vectorSintetico, type Stability, type TiltConfig, type TiltResult } from "./tiltPhysics";
import { isValidReference, loadTrials, saveTrials, type TiltTrial } from "./tiltSession";

export type { AnglePoint, CaptureView } from "./tiltCapture";

/** Lo que muestran Demostración y Ciencia: siempre la MISMA lectura. */
export type TiltSnapshot = {
  source: "live" | "frozen" | "sim";
  result: TiltResult | null;
  stability: Stability;
  history: AnglePoint[];
  /** performance.now() del instante representado. */
  atMs: number;
  totalSamples: number;
  validSamples: number;
};

export type TiltSection = "demo" | "science" | "results";

const UI_INTERVAL_MS = 80;

export function currentScreenOrientation(): string {
  if (typeof screen !== "undefined" && screen.orientation?.type) return screen.orientation.type;
  return "desconocida";
}

/** Lectura sintética para ensayar sin sensores. Pasa por el mismo cálculo, nunca se guarda. */
function simulatedSnapshot(angleDeg: number, nowMs: number, config: TiltConfig): TiltSnapshot {
  const sample: MotionSample = {
    tMs: nowMs,
    acceleration: { x: 0, y: 0, z: 0 },
    accelerationIncludingGravity: vectorSintetico(angleDeg),
    rotationRate: { x: 0, y: 0, z: 0 },
    orientation: { x: null, y: null, z: null },
    intervalMs: null,
  };
  return {
    source: "sim",
    result: lecturaDeInclinacion(sample, config),
    stability: { ...EMPTY_STABILITY, state: "stable", reason: "Simulación: valores sin ruido, no son datos del sensor." },
    history: [],
    atMs: nowMs,
    totalSamples: 0,
    validSamples: 0,
  };
}

/**
 * Estado del laboratorio de inclinación. Se suscribe a la ÚNICA fuente de
 * muestras de la app (`sensors.subscribe`), procesa cada muestra y publica la
 * UI cada 80 ms. Vive en App, así que cambiar de pestaña no pierde nada.
 */
export function useTiltLab(sensors: SensorController, config: TiltConfig = DEFAULT_TILT_CONFIG) {
  const [trials, setTrials] = useState<TiltTrial[]>(() => loadTrials());
  const [storageOk, setStorageOk] = useState(true);
  const [live, setLive] = useState<TiltSnapshot>(() => ({ source: "live", result: null, stability: EMPTY_STABILITY, history: [], atMs: 0, totalSamples: 0, validSamples: 0 }));
  const [frozen, setFrozen] = useState<TiltSnapshot | null>(null);
  const [sim, setSim] = useState({ enabled: false, angleDeg: 30 });
  const [capture, setCapture] = useState<CaptureView>(() => captureView({ phase: "idle" }, 0, config));
  // Navegación del laboratorio: sobrevive al cambiar de pestaña.
  const [started, setStarted] = useState(false);
  const [section, setSection] = useState<TiltSection>("demo");

  const trialsRef = useRef(trials);
  trialsRef.current = trials;
  const streamRef = useRef(createStream());
  const machineRef = useRef<Machine>({ phase: "idle" });
  const lastUiRef = useRef(0);

  const publish = useCallback((nowMs: number) => {
    lastUiRef.current = performance.now();
    const stream = streamRef.current;
    setLive({
      source: "live",
      result: stream.lastResult,
      stability: stream.stability,
      history: stream.history.slice(),
      atMs: nowMs,
      totalSamples: stream.total,
      validSamples: stream.valid,
    });
    setCapture(captureView(machineRef.current, nowMs, config));
  }, [config]);

  const applyOutcome = useCallback((outcome: StepOutcome, nowMs: number) => {
    const previous = machineRef.current;
    machineRef.current = outcome.machine;
    if (outcome.trial) {
      const replaceId = previous.phase === "waiting" || previous.phase === "capturing" ? previous.replaceId : null;
      const next = applyTrial(trialsRef.current, outcome.trial, replaceId);
      trialsRef.current = next;
      setTrials(next);
    }
    if (outcome.changed) publish(nowMs);
  }, [publish]);

  const onSample = useCallback((sample: MotionSample) => {
    const { result, stability } = processSample(streamRef.current, sample, config);
    applyOutcome(stepMachine(machineRef.current, sample, result, stability, config, trialsRef.current), sample.tMs);
    if (performance.now() - lastUiRef.current >= UI_INTERVAL_MS) publish(sample.tMs);
  }, [applyOutcome, config, publish]);

  useEffect(() => sensors.subscribe(onSample), [sensors.subscribe, onSample]);

  // Sin eventos no hay muestras que avancen el estado: un reloj detecta la pérdida de señal.
  const sensorsActive = sensors.state === "active";
  useEffect(() => {
    if (!sensorsActive) return undefined;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const stream = streamRef.current;
      const outcome = tickMachine(machineRef.current, now, stream.lastSampleAt, config);
      applyOutcome(outcome, now);
      const stale = stream.lastSampleAt === null || now - stream.lastSampleAt > config.staleMs;
      if (stale && stream.stability.state !== "insufficient") {
        stream.stability = { ...EMPTY_STABILITY, reason: "Se perdió la señal del sensor." };
        publish(now);
      } else if (machineRef.current.phase === "capturing" && !outcome.changed) {
        publish(now);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [applyOutcome, config, publish, sensorsActive]);

  // Un cambio de orientación de pantalla invalida la prueba en curso.
  useEffect(() => {
    const onChange = () => {
      const machine = failMachine(machineRef.current, "La orientación de la pantalla cambió durante la medición; repítela con la pantalla fija.");
      if (machine !== machineRef.current) applyOutcome({ machine, changed: true }, performance.now());
    };
    screen.orientation?.addEventListener?.("change", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      screen.orientation?.removeEventListener?.("change", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, [applyOutcome]);

  useEffect(() => {
    setStorageOk(saveTrials(trials));
  }, [trials]);

  const startCapture = useCallback((referenceDeg: number, replaceId: string | null = null): { ok: true } | { ok: false; reason: string } => {
    if (sensors.state !== "active") return { ok: false, reason: "Activa los sensores antes de medir." };
    if (sim.enabled) return { ok: false, reason: "Desactiva la simulación: solo se registran datos reales del sensor." };
    if (!isValidReference(referenceDeg)) return { ok: false, reason: "La referencia debe estar entre 0° y 90°." };
    setFrozen(null);
    const now = performance.now();
    applyOutcome({ machine: startMachine(referenceDeg, replaceId, now, currentScreenOrientation()), changed: true }, now);
    return { ok: true };
  }, [applyOutcome, sensors.state, sim.enabled]);

  const resetCapture = useCallback(() => {
    applyOutcome({ machine: { phase: "idle" }, changed: true }, performance.now());
  }, [applyOutcome]);

  const freeze = useCallback(() => {
    setFrozen({ ...live, source: "frozen", history: live.history.slice() });
  }, [live]);

  const unfreeze = useCallback(() => setFrozen(null), []);

  const deleteTrial = useCallback((id: string) => {
    setTrials((current) => current.filter((trial) => trial.id !== id));
  }, []);

  const clearTrials = useCallback(() => setTrials([]), []);

  const setSimEnabled = useCallback((enabled: boolean) => {
    if (enabled) {
      setFrozen(null);
      applyOutcome({ machine: { phase: "idle" }, changed: true }, performance.now());
    }
    setSim((current) => ({ ...current, enabled }));
  }, [applyOutcome]);

  const setSimAngle = useCallback((angleDeg: number) => {
    setSim((current) => ({ ...current, angleDeg: Math.max(0, Math.min(90, angleDeg)) }));
  }, []);

  const view: TiltSnapshot = useMemo(() => {
    if (sim.enabled) return simulatedSnapshot(sim.angleDeg, performance.now(), config);
    return frozen ?? live;
  }, [config, frozen, live, sim.angleDeg, sim.enabled]);

  return {
    config,
    started,
    setStarted,
    section,
    setSection,
    trials,
    storageOk,
    live,
    view,
    frozen: frozen !== null,
    freeze,
    unfreeze,
    sim,
    setSimEnabled,
    setSimAngle,
    capture,
    startCapture,
    resetCapture,
    deleteTrial,
    clearTrials,
  };
}

export type TiltLab = ReturnType<typeof useTiltLab>;
