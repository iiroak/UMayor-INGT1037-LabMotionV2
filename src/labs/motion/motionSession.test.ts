import { describe, expect, it } from "vitest";
import { createStream, processSample, startMachine, stepMachine, type Machine } from "./motionCapture";
import { csvText, MOTION_EXPORT_FORMAT, samplesCsv, sessionJson, trialsCsv } from "./motionExport";
import { DEFAULT_MOTION_CONFIG, analizarMovimiento, evaluarReposo, type MotionKind } from "./motionPhysics";
import {
  MAX_TRIALS,
  REPETITIONS_TARGET,
  applyTrial,
  buildConclusion,
  buildTrial,
  guidedProgress,
  isValidDistance,
  loadTrials,
  nextAttempt,
  referenceComparison,
  reportSummary,
  saveTrials,
  storageKey,
  summarize,
  type MotionTrial,
} from "./motionSession";
import { mruProfile, mruaProfile, syntheticMotion } from "./motionSynthetic";

const START = 10_000;

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

function trialOf(kind: MotionKind, attempt = 1, referenceM: number | null = null, a = 2): MotionTrial {
  const samples =
    kind === "mrua"
      ? syntheticMotion({ durationS: 4.5, thetaDeg: 15, downhillDeg: 20, noise: 0.03, seed: attempt, profile: mruaProfile({ a, startS: 1.6, runS: 1.4 }) })
      : syntheticMotion({ durationS: 5.3, motionDeg: 33, noise: 0.03, seed: attempt, profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 1.5, brake: 4, startS: 1.6 }) });
  const rest = evaluarReposo(samples.filter((s) => s.tMs <= START + 1500), START + 1500);
  if (rest.state !== "rest") throw new Error(rest.reason);
  const result = analizarMovimiento(kind, rest.baseline, samples.filter((s) => s.tMs >= START + 1300));
  if (!result.ok) throw new Error(result.reason);
  return buildTrial({ kind, attempt, analysis: result.analysis, referenceM, screenOrientation: "portrait-primary" });
}

describe("prueba y repeticiones", () => {
  it("construye una prueba con calidad, umbrales y referencia válida", () => {
    const trial = trialOf("mrua", 1, 1.2);
    expect(trial.quality).toBe("ok");
    expect(trial.config).toEqual(DEFAULT_MOTION_CONFIG);
    expect(trial.referenceM).toBe(1.2);
    expect(trialOf("mrua", 1, -3).referenceM).toBeNull();
    expect(trialOf("mrua", 1, 0).referenceM).toBeNull();
    expect(isValidDistance(Number.NaN)).toBe(false);
    expect(isValidDistance(101)).toBe(false);
  });

  it("numera los intentos, lleva el avance guiado y respeta el máximo", () => {
    const trials = [trialOf("mru", 1), trialOf("mru", 2)];
    expect(nextAttempt(trials)).toBe(3);
    expect(nextAttempt([])).toBe(1);
    expect(guidedProgress(trials)).toEqual({ done: 2, target: REPETITIONS_TARGET });
    expect(guidedProgress([...trials, trialOf("mru", 3), trialOf("mru", 4)]).done).toBe(REPETITIONS_TARGET);
    const many = Array.from({ length: MAX_TRIALS + 3 }, (_, i) => ({ ...trials[0], id: `id${i}`, attempt: i + 1 }));
    const capped = applyTrial(many.slice(0, MAX_TRIALS), many[MAX_TRIALS], null);
    expect(capped).toHaveLength(MAX_TRIALS);
    expect(capped[0].attempt).toBe(2);
  });

  it("repetir una prueba reemplaza a la anterior", () => {
    const [a, b] = [trialOf("mru", 1), trialOf("mru", 2)];
    const replacement = { ...trialOf("mru", 2), id: "nuevo" };
    const result = applyTrial([a, b], replacement, b.id);
    expect(result.map((trial) => trial.id)).toEqual([a.id, "nuevo"]);
  });

  it("compara la distancia estimada con la medida con cinta", () => {
    const trial = trialOf("mru", 1, 1.4);
    const comparison = referenceComparison(trial)!;
    expect(comparison.reference).toBe(1.4);
    expect(comparison.absolute).toBeCloseTo(Math.abs(comparison.measured - 1.4), 10);
    expect(comparison.percent).toBeCloseTo((comparison.absolute / 1.4) * 100, 8);
    expect(referenceComparison(trialOf("mru", 1))).toBeNull();
  });
});

describe("resumen y conclusión", () => {
  it("MRU: describe un movimiento compatible con uniforme sin afirmar calibración", () => {
    const trials = [trialOf("mru", 1), trialOf("mru", 2), trialOf("mru", 3)];
    const summary = summarize("mru", trials);
    expect(summary.n).toBe(3);
    expect(summary.primary!.mean).toBeGreaterThan(0.72);
    const text = buildConclusion("mru", trials).join("\n");
    expect(text).toContain("velocidad de crucero");
    expect(text).toContain("compatibles con un movimiento rectilíneo uniforme");
    expect(text).not.toMatch(/calibrad[oa]s?\b/i);
    expect(text).toContain("no certifican la calibración");
    expect(text).not.toContain("Procedimiento incompleto");
  });

  it("MRUA: compara con g·sen θ y estima μ; pide más repeticiones si faltan", () => {
    const trials = [trialOf("mrua", 1)];
    const text = buildConclusion("mrua", trials).join("\n");
    expect(text).toContain("g·sen θ");
    expect(text).toContain("coeficiente de roce");
    expect(text).toContain("Procedimiento incompleto");
    expect(text).not.toMatch(/calibrad[oa]s?\b/i);
  });

  it("sin pruebas no inventa resultados", () => {
    expect(buildConclusion("mru", [])).toEqual(["Aún no hay mediciones registradas. Registra al menos una prueba para obtener resultados."]);
    expect(summarize("mrua", []).primary).toBeNull();
  });

  it("una variación grande de velocidad no se presenta como uniforme", () => {
    const trial = trialOf("mru", 1);
    const slowed = { ...trial, analysis: { ...trial.analysis, mru: { ...trial.analysis.mru!, vVariation: 0.4 } } };
    const text = buildConclusion("mru", [slowed]).join("\n");
    expect(text).not.toContain("compatibles con un movimiento rectilíneo uniforme");
    expect(text).toContain("no se mantuvo tan constante");
  });

  it("el informe de texto incluye la tabla y la versión del cálculo", () => {
    const report = reportSummary("mrua", [trialOf("mrua", 1, 1.1)], { device: "Prueba", date: new Date("2026-11-18T12:00:00Z") });
    expect(report).toContain("LabMotion — Movimiento rectilíneo uniformemente acelerado (MRUA)");
    expect(report).toContain("labmotion-motion-1.0.0");
    expect(report).toContain("P1 |");
    expect(report).toContain("1,10");
  });
});

describe("persistencia local", () => {
  it("guarda y recupera por laboratorio sin mezclar MRU con MRUA", () => {
    const storage = new MemoryStorage();
    const mruTrials = [trialOf("mru", 1)];
    const mruaTrials = [trialOf("mrua", 1), trialOf("mrua", 2)];
    expect(saveTrials("mru", mruTrials, storage)).toBe(true);
    expect(saveTrials("mrua", mruaTrials, storage)).toBe(true);
    expect(loadTrials("mru", storage)).toHaveLength(1);
    expect(loadTrials("mrua", storage)).toHaveLength(2);
    expect(storageKey("mru")).toBe("labmotion.v2.mru.trials");
    expect(saveTrials("mru", [], storage)).toBe(true);
    expect(loadTrials("mru", storage)).toEqual([]);
    expect(loadTrials("mrua", storage)).toHaveLength(2);
  });

  it("ignora datos corruptos, de otra versión o de otro laboratorio", () => {
    const storage = new MemoryStorage();
    storage.setItem(storageKey("mru"), "{no es json");
    expect(loadTrials("mru", storage)).toEqual([]);
    storage.setItem(storageKey("mru"), JSON.stringify({ version: 99, trials: [trialOf("mru")] }));
    expect(loadTrials("mru", storage)).toEqual([]);
    storage.setItem(storageKey("mru"), JSON.stringify({ version: 1, trials: [trialOf("mrua")] }));
    expect(loadTrials("mru", storage)).toEqual([]);
    storage.setItem(storageKey("mru"), JSON.stringify({ version: 1, trials: [{ id: "x" }] }));
    expect(loadTrials("mru", storage)).toEqual([]);
  });

  it("informa si el navegador no deja guardar", () => {
    const full: Storage = Object.assign(new MemoryStorage(), {
      setItem() {
        throw new Error("QuotaExceededError");
      },
    });
    expect(saveTrials("mru", [trialOf("mru")], full)).toBe(false);
    expect(saveTrials("mru", [trialOf("mru")], null)).toBe(false);
    expect(loadTrials("mru", null)).toEqual([]);
  });

  it("una prueba guardada cabe holgadamente en la cuota de localStorage", () => {
    const size = JSON.stringify(trialOf("mrua", 1)).length;
    expect(size * MAX_TRIALS).toBeLessThan(500_000);
  });
});

describe("exportación", () => {
  it("el CSV de resultados tiene una cabecera, una fila por prueba y punto decimal", () => {
    const csv = trialsCsv("mru", [trialOf("mru", 1, 1.4), trialOf("mru", 2), trialOf("mrua", 1)]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0].startsWith("prueba,fecha,calidad,v_crucero_m_s")).toBe(true);
    expect(lines[1].split(",").length).toBe(lines[0].split(",").length);
    expect(lines[1]).not.toMatch(/\d,\d{3,}\s/);
    expect(csv).not.toContain("#");
    expect(csv).not.toContain("no_aplica");
  });

  it("el CSV de MRUA incluye la inclinación, g·sen θ y μ", () => {
    const csv = trialsCsv("mrua", [trialOf("mrua", 1)]);
    const [header, row] = csv.split("\n");
    const columns = header.split(",");
    const cells = row.split(",");
    expect(Number(cells[columns.indexOf("theta_deg")])).toBeCloseTo(15, 0);
    expect(Number(cells[columns.indexOf("a_ideal_m_s2")])).toBeGreaterThan(2);
    expect(columns).toContain("mu_estimado");
  });

  it("escapa comas y comillas de los avisos", () => {
    expect(csvText('uno, "dos"')).toBe('"uno, ""dos"""');
    expect(csvText("simple")).toBe("simple");
  });

  it("el CSV de muestras trae la serie a(t), v(t), x(t) con prueba", () => {
    const csv = samplesCsv("mrua", [trialOf("mrua", 1)]);
    const [header, first] = csv.split("\n");
    expect(header).toBe("prueba,t_s,a_m_s2,v_m_s,x_m");
    expect(first.startsWith("P1,")).toBe(true);
    expect(csv.split("\n").length).toBeGreaterThan(30);
  });

  it("el JSON trae formato, versión, umbrales y marca que no es simulación", () => {
    const parsed = JSON.parse(sessionJson("mru", [trialOf("mru", 1), trialOf("mrua", 1)], { device: "Prueba", exportedAt: new Date("2026-11-18T12:00:00Z") }));
    expect(parsed.format).toBe(MOTION_EXPORT_FORMAT.mru);
    expect(parsed.calcVersion).toBe("labmotion-motion-1.0.0");
    expect(parsed.simulated).toBe(false);
    expect(parsed.trials).toHaveLength(1);
    expect(parsed.defaultConfig.triggerAccel).toBe(DEFAULT_MOTION_CONFIG.triggerAccel);
  });
});

describe("captura → sesión", () => {
  it("la prueba que sale de la máquina se puede resumir y exportar", () => {
    const samples = syntheticMotion({ durationS: 5.7, thetaDeg: 12, downhillDeg: 75, noise: 0.03, profile: mruaProfile({ a: 1.5, startS: 2.8, runS: 1.4 }) });
    const stream = createStream();
    let machine: Machine = startMachine("mrua", null, samples[0].tMs, "portrait-primary");
    for (const sample of samples) {
      const baseline = machine.phase === "armed" || machine.phase === "recording" ? machine.baseline : null;
      processSample(stream, sample, baseline, DEFAULT_MOTION_CONFIG);
      machine = stepMachine(machine, sample, stream, DEFAULT_MOTION_CONFIG, []).machine;
      if (machine.phase === "done" || machine.phase === "failed") break;
    }
    expect(machine.phase).toBe("done");
    if (machine.phase !== "done") return;
    const csv = trialsCsv("mrua", [machine.trial]);
    expect(csv.split("\n")).toHaveLength(2);
    expect(summarize("mrua", [machine.trial]).primary!.mean).toBeGreaterThan(1.4);
  });
});
