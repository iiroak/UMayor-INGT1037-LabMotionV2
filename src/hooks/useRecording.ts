import { useCallback, useEffect, useRef, useState } from "react";
import { summarizeMeasurement, type MeasurementSummary } from "../lib/kinematics";
import type { MotionSample } from "../lib/sensors";
import type { SensorController } from "./useSensors";

export type Measurement = {
  samples: MotionSample[];
  summary: MeasurementSummary;
};

const MAX_RECORDING_SAMPLES = 3600;

/** Captura general de la pestaña Capturar (igual que LabMotion v1). */
export function useRecording(sensors: SensorController) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const recordingRef = useRef(false);
  const samplesRef = useRef<MotionSample[]>([]);
  const startedAtRef = useRef(0);

  useEffect(() => sensors.subscribe((sample) => {
    if (recordingRef.current && samplesRef.current.length < MAX_RECORDING_SAMPLES) samplesRef.current.push(sample);
  }), [sensors.subscribe]);

  useEffect(() => {
    if (!isRecording) return undefined;
    const timer = window.setInterval(() => setElapsedMs(performance.now() - startedAtRef.current), 100);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  const start = useCallback(async (): Promise<boolean> => {
    const ready = sensors.state === "active" || (await sensors.enable());
    if (!ready) return false;
    samplesRef.current = [];
    startedAtRef.current = performance.now();
    recordingRef.current = true;
    setMeasurement(null);
    setElapsedMs(0);
    setIsRecording(true);
    return true;
  }, [sensors]);

  /** Devuelve el número de muestras guardadas (0 si no alcanzó). */
  const stop = useCallback((): number => {
    recordingRef.current = false;
    setIsRecording(false);
    const captured = samplesRef.current.slice();
    const durationMs = performance.now() - startedAtRef.current;
    if (captured.length < 2) return 0;
    setMeasurement({ samples: captured, summary: { ...summarizeMeasurement(captured), durationMs } });
    return captured.length;
  }, []);

  const clear = useCallback(() => setMeasurement(null), []);

  return { isRecording, elapsedMs, measurement, start, stop, clear, maxSamples: MAX_RECORDING_SAMPLES };
}

export type Recording = ReturnType<typeof useRecording>;
