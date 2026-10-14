import { describe, expect, it } from "vitest";
import { syntheticSeries } from "./testUtils";
import { samplesCsv, recomputeTheta, sessionJson, trialsCsv } from "./tiltExport";
import { lecturaDeInclinacion, type TiltReading } from "./tiltPhysics";
import {
  buildConclusion,
  buildTrial,
  guidedProgress,
  loadTrials,
  nextAttempt,
  reportSummary,
  saveTrials,
  summarizeByReference,
  type TiltTrial,
} from "./tiltSession";

function trialFor(referenceDeg: number, measuredDeg: number, attempt = 1, noiseDeg = 0.05): TiltTrial {
  const samples = syntheticSeries(1000, 2000, measuredDeg, noiseDeg);
  const readings = samples.flatMap((sample) => {
    const result = lecturaDeInclinacion(sample);
    return result.ok ? [result.reading] : [];
  });
  const result = buildTrial({ referenceDeg, attempt, samples, readings, waitMs: 800, restarts: 0, screenOrientation: "portrait-primary", now: new Date("2026-10-13T12:00:00Z") });
  if (!result.ok) throw new Error(result.reason);
  return result.trial;
}

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, value); }
}

describe("buildTrial", () => {
  it("registra la lectura real promediada y el error absoluto (referencia 30°)", () => {
    const trial = trialFor(30, 31.2);
    expect(trial.meanDeg).toBeCloseTo(31.2, 1);
    expect(trial.absErrorDeg).toBeCloseTo(1.2, 1);
    expect(trial.percentError).toBeCloseTo(4, 0);
    expect(trial.validSamples).toBe(trial.samples.length);
    expect(trial.frequencyHz).toBeGreaterThan(55);
    expect(trial.durationMs).toBeGreaterThan(1900);
    expect(trial.mode).toBe("diferencia");
    expect(trial.quality).toBe("ok");
  });

  it("con referencia 0° el porcentaje no aplica", () => {
    const trial = trialFor(0, 0.6);
    expect(trial.percentError).toBeNull();
    expect(trial.absErrorDeg).toBeCloseTo(0.6, 1);
  });

  it("rechaza pruebas sin lecturas suficientes (no fabrica datos)", () => {
    const samples = syntheticSeries(0, 50, 30);
    const result = buildTrial({ referenceDeg: 30, attempt: 1, samples, readings: [] as TiltReading[], waitMs: 0, restarts: 0, screenOrientation: "x" });
    expect(result.ok).toBe(false);
  });

  it("rechaza referencias fuera de 0–90°", () => {
    const samples = syntheticSeries(0, 2000, 30);
    const readings = samples.map((sample) => {
      const result = lecturaDeInclinacion(sample);
      if (!result.ok) throw new Error("lectura");
      return result.reading;
    });
    expect(buildTrial({ referenceDeg: -5, attempt: 1, samples, readings, waitMs: 0, restarts: 0, screenOrientation: "x" }).ok).toBe(false);
    expect(buildTrial({ referenceDeg: 120, attempt: 1, samples, readings, waitMs: 0, restarts: 0, screenOrientation: "x" }).ok).toBe(false);
    expect(buildTrial({ referenceDeg: Number.NaN, attempt: 1, samples, readings, waitMs: 0, restarts: 0, screenOrientation: "x" }).ok).toBe(false);
  });

  it("advierte cuando la gravedad es una estimación en reposo", () => {
    const samples = syntheticSeries(0, 2000, 45).map((sample) => ({ ...sample, acceleration: { x: null, y: null, z: null } }));
    const readings = samples.flatMap((sample) => {
      const result = lecturaDeInclinacion(sample);
      return result.ok ? [result.reading] : [];
    });
    const result = buildTrial({ referenceDeg: 45, attempt: 1, samples, readings, waitMs: 0, restarts: 0, screenOrientation: "x" });
    expect(result.ok && result.trial.mode).toBe("reposo");
    expect(result.ok && result.trial.quality).toBe("advertencia");
  });
});

describe("sesión y resultados", () => {
  const trials = [trialFor(0, 0.4, 1), trialFor(30, 31, 1), trialFor(30, 32, 2), trialFor(60, 58.5, 1)];

  it("numera pruebas por referencia y rellena huecos", () => {
    expect(nextAttempt(trials, 30)).toBe(3);
    expect(nextAttempt(trials, 45)).toBe(1);
    expect(nextAttempt(trials.filter((trial) => !(trial.referenceDeg === 30 && trial.attempt === 1)), 30)).toBe(1);
  });

  it("resume por referencia sin ocultar cuántas pruebas hay", () => {
    const summary = summarizeByReference(trials);
    expect(summary.map((item) => item.referenceDeg)).toEqual([0, 30, 60]);
    const thirty = summary.find((item) => item.referenceDeg === 30)!;
    expect(thirty.n).toBe(2);
    expect(thirty.meanDeg).toBeCloseTo(31.5, 1);
    expect(thirty.absErrorDeg).toBeCloseTo(1.5, 1);
    expect(summary.find((item) => item.referenceDeg === 0)!.percentError).toBeNull();
  });

  it("calcula el avance guiado sobre 12 pruebas", () => {
    expect(guidedProgress(trials)).toEqual({ done: 4, target: 12 });
    expect(guidedProgress([])).toEqual({ done: 0, target: 12 });
  });

  it("la conclusión solo usa datos presentes y declara lo incompleto", () => {
    const lines = buildConclusion(trials);
    expect(lines.join(" ")).toMatch(/Para una referencia de 30°, se midió en promedio 31,5°/);
    expect(lines.join(" ")).toMatch(/Procedimiento incompleto/);
    expect(lines.join(" ")).toMatch(/45°/);
    expect(lines.join(" ")).not.toMatch(/calibrado|validado|precisión demostrada/i);
    expect(buildConclusion([])[0]).toMatch(/Aún no hay mediciones/);
  });

  it("el resumen para el informe incluye la tabla y «No aplica» para 0°", () => {
    const text = reportSummary(trials, { device: "Prueba sintética", date: new Date("2026-10-13T12:00:00Z") });
    expect(text).toMatch(/Ref\. \| P1 \| P2 \| P3/);
    expect(text).toMatch(/No aplica/);
  });
});

describe("exportación", () => {
  const trials = [trialFor(30, 30.8, 1), trialFor(0, 0.3, 1)];

  it("CSV de resultados: una fila por prueba, con no_aplica para 0°", () => {
    const csv = trialsCsv(trials, new Date("2026-10-13T12:00:00Z"));
    const rows = csv.split("\n").filter((line) => !line.startsWith("#"));
    expect(rows[0]).toMatch(/^trial_id,created_at,reference_deg/);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatch(/no_aplica/);
  });

  it("CSV de muestras: θ recalculado coincide con el registrado", () => {
    const csv = samplesCsv(trials);
    const rows = csv.split("\n").filter((line) => !line.startsWith("#"));
    const header = rows[0].split(",");
    const thetaIndex = header.indexOf("theta_deg");
    expect(rows.length - 1).toBe(trials.reduce((total, trial) => total + trial.samples.length, 0));
    const first30 = rows.find((row) => row.includes(",30.00,"))!;
    expect(Number(first30.split(",")[thetaIndex])).toBeCloseTo(trials[0].angles[0].thetaDeg, 4);
    expect(recomputeTheta(trials[0].samples[0])).toBeCloseTo(trials[0].angles[0].thetaDeg, 10);
  });

  it("JSON con metadatos, configuración y versión del cálculo", () => {
    const json = JSON.parse(sessionJson(trials, { diagnostics: null, exportedAt: new Date("2026-10-13T12:00:00Z") }));
    expect(json.format).toBe("labmotion-tilt-session-v1");
    expect(json.calcVersion).toMatch(/^labmotion-tilt-/);
    expect(json.config.captureMs).toBeGreaterThan(0);
    expect(json.trials).toHaveLength(2);
    expect(json.trials[0].samples[0].tMs).toBe(0);
    expect(json.summary.length).toBe(2);
  });
});

describe("persistencia local", () => {
  it("guarda y recupera las pruebas", () => {
    const storage = new MemoryStorage();
    const trials = [trialFor(45, 44.6)];
    expect(saveTrials(trials, storage)).toBe(true);
    const loaded = loadTrials(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].meanDeg).toBeCloseTo(trials[0].meanDeg, 12);
  });

  it("ignora datos corruptos o de otra versión", () => {
    const storage = new MemoryStorage();
    storage.setItem("labmotion.v2.tilt.trials", "{no es json");
    expect(loadTrials(storage)).toEqual([]);
    storage.setItem("labmotion.v2.tilt.trials", JSON.stringify({ version: 99, trials: [] }));
    expect(loadTrials(storage)).toEqual([]);
    expect(loadTrials(null)).toEqual([]);
  });
});
