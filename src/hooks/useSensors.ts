import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { frecuenciaDeMuestreo } from "../lib/fisica";
import {
  getSensorCapabilities,
  requestMotionPermission,
  subscribeToSensors,
  type MotionSample,
  type SensorCapabilities,
  type SensorState,
} from "../lib/sensors";

/** Llegada de datos después de activar: distingue "sin datos" de "se perdió". */
export type SignalState = "idle" | "waiting" | "receiving" | "lost";

export type SampleListener = (sample: MotionSample) => void;

export type SensorController = {
  state: SensorState;
  error: string;
  signal: SignalState;
  capabilities: SensorCapabilities;
  latest: MotionSample | null;
  liveSamples: MotionSample[];
  frequencyHz: number | null;
  enable: () => Promise<boolean>;
  /** Recibe TODAS las muestras (sin el muestreo de 80 ms de la UI). */
  subscribe: (listener: SampleListener) => () => void;
};

const LIVE_BUFFER = 720;
const UI_INTERVAL_MS = 80;
const NO_DATA_AFTER_MS = 1500;
const LOST_AFTER_MS = 1000;

/**
 * Única suscripción a DeviceMotion/DeviceOrientation de la app. Las pestañas
 * leen el estado muestreado para la UI; el laboratorio se suscribe con
 * `subscribe` para procesar cada muestra sin crear otro listener del navegador.
 */
export function useSensors(): SensorController {
  const [state, setState] = useState<SensorState>("idle");
  const [error, setError] = useState("");
  const [signal, setSignal] = useState<SignalState>("idle");
  const [latest, setLatest] = useState<MotionSample | null>(null);
  const [liveSamples, setLiveSamples] = useState<MotionSample[]>([]);
  const [frequencyHz, setFrequencyHz] = useState<number | null>(null);
  const [capabilities] = useState<SensorCapabilities>(() => getSensorCapabilities());

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const listenersRef = useRef(new Set<SampleListener>());
  const liveBufferRef = useRef<MotionSample[]>([]);
  const sampleTimesRef = useRef<number[]>([]);
  const lastUiRef = useRef(0);
  const enabledAtRef = useRef<number | null>(null);
  const lastSampleAtRef = useRef<number | null>(null);
  const stateRef = useRef<SensorState>("idle");
  stateRef.current = state;

  const handleSample = useCallback((sample: MotionSample) => {
    lastSampleAtRef.current = sample.tMs;
    const buffer = liveBufferRef.current;
    buffer.push(sample);
    if (buffer.length > LIVE_BUFFER) buffer.splice(0, buffer.length - LIVE_BUFFER);

    const times = sampleTimesRef.current;
    times.push(sample.tMs);
    while (times.length > 2 && sample.tMs - times[0] > 1000) times.shift();

    for (const listener of listenersRef.current) {
      try {
        listener(sample);
      } catch (cause) {
        console.error("LabMotion: error procesando una muestra", cause);
      }
    }

    const now = performance.now();
    if (now - lastUiRef.current >= UI_INTERVAL_MS) {
      lastUiRef.current = now;
      setLatest(sample);
      setLiveSamples([...buffer]);
      if (times.length > 1) setFrequencyHz(frecuenciaDeMuestreo(times));
    }
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (stateRef.current === "active" && unsubscribeRef.current) return true;
    setState("requesting");
    setError("");
    // Debe llamarse dentro del gesto del usuario (iOS exige requestPermission ahí).
    const permission = await requestMotionPermission();

    if (permission === "insecure") {
      setState("error");
      setError("Abre la dirección HTTPS de LabMotion para usar los sensores.");
      return false;
    }
    if (permission === "unsupported") {
      setState("unsupported");
      setError("Este navegador no expone DeviceMotionEvent.");
      return false;
    }
    if (permission === "denied") {
      setState("denied");
      setError("El permiso de movimiento fue rechazado. Revisa los permisos del sitio y vuelve a intentar.");
      return false;
    }

    unsubscribeRef.current?.();
    unsubscribeRef.current = subscribeToSensors(handleSample);
    enabledAtRef.current = performance.now();
    lastSampleAtRef.current = null;
    setSignal("waiting");
    setState("active");
    return true;
  }, [handleSample]);

  const subscribe = useCallback((listener: SampleListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  // Vigila la llegada de datos: "sin datos" si nunca llegan, "perdida" si se cortan.
  useEffect(() => {
    if (state !== "active") return undefined;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const last = lastSampleAtRef.current;
      let next: SignalState;
      if (last === null) next = now - (enabledAtRef.current ?? now) > NO_DATA_AFTER_MS ? "lost" : "waiting";
      else next = now - last > LOST_AFTER_MS ? "lost" : "receiving";
      setSignal((current) => (current === next ? current : next));
    }, 250);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => () => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
  }, []);

  return useMemo(
    () => ({ state, error, signal, capabilities, latest, liveSamples, frequencyHz, enable, subscribe }),
    [state, error, signal, capabilities, latest, liveSamples, frequencyHz, enable, subscribe],
  );
}

/** Texto corto del estado de los sensores para la cabecera y las tarjetas. */
export function sensorStatusLabel(state: SensorState, signal: SignalState, hasEverReceived: boolean): string {
  if (state === "active") {
    if (signal === "lost") return hasEverReceived ? "Se perdió la señal" : "Sin datos";
    if (signal === "waiting") return "Esperando datos";
    return "Sensores activos";
  }
  if (state === "requesting") return "Solicitando permiso";
  if (state === "denied") return "Permiso rechazado";
  if (state === "unsupported") return "No compatible";
  if (state === "error") return "Se requiere HTTPS";
  return "Sensores inactivos";
}
