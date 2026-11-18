import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SensorController } from "../../hooks/useSensors";
import { extractRegion } from "../../lib/sourceRegions";
import { LabsScreen } from "../../screens/LabsScreen";
import { LABS, labById } from "../registry";
import { labSensorStatus } from "../tilt/TiltIntro";
import physicsSource from "./motionPhysics.ts?raw";
import { EMPTY_REST, captureView } from "./motionCapture";
import { LAB_CONTENT } from "./motionContent";
import { MotionAnalysisView } from "./MotionAnalysisView";
import { MotionDemo } from "./MotionDemo";
import { MotionIntro } from "./MotionIntro";
import { MotionResults } from "./MotionResults";
import { MotionScience } from "./MotionScience";
import { DEFAULT_MOTION_CONFIG, analizarMovimiento, evaluarReposo, type MotionKind } from "./motionPhysics";
import { buildTrial, type MotionTrial } from "./motionSession";
import { DEFAULT_SIM, simulateAnalysis } from "./motionSimulation";
import { mruProfile, mruaProfile, syntheticMotion } from "./motionSynthetic";
import type { MotionLab } from "./useMotionLab";

const noop = () => undefined;

function sensorsMock(overrides: Partial<SensorController> = {}): SensorController {
  return {
    state: "idle",
    error: "",
    signal: "idle",
    capabilities: { secureContext: true, deviceMotion: true, deviceOrientation: true, accelerometer: false, gyroscope: false, linearAcceleration: false },
    latest: null,
    liveSamples: [],
    frequencyHz: null,
    enable: async () => true,
    subscribe: () => noop,
    ...overrides,
  };
}

function trialOf(kind: MotionKind, attempt = 1): MotionTrial {
  const samples =
    kind === "mrua"
      ? syntheticMotion({ durationS: 4.5, thetaDeg: 15, downhillDeg: 20, noise: 0.03, profile: mruaProfile({ a: 2, startS: 1.6, runS: 1.4 }) })
      : syntheticMotion({ durationS: 5.3, motionDeg: 33, noise: 0.03, profile: mruProfile({ push: 2, pushS: 0.4, cruiseS: 1.5, brake: 4, startS: 1.6 }) });
  const rest = evaluarReposo(samples.filter((s) => s.tMs <= 11_500), 11_500);
  if (rest.state !== "rest") throw new Error(rest.reason);
  const result = analizarMovimiento(kind, rest.baseline, samples.filter((s) => s.tMs >= 11_300));
  if (!result.ok) throw new Error(result.reason);
  return buildTrial({ kind, attempt, analysis: result.analysis, referenceM: attempt === 1 ? 1.4 : null, screenOrientation: "portrait-primary" });
}

function labMock(kind: MotionKind, overrides: Partial<MotionLab> = {}): MotionLab {
  return {
    kind,
    config: DEFAULT_MOTION_CONFIG,
    active: true,
    started: true,
    setStarted: noop,
    section: "demo",
    setSection: noop,
    trials: [],
    storageOk: true,
    live: { rest: EMPTY_REST, history: [], atMs: 0, totalSamples: 0, thetaDeg: null },
    capture: captureView({ phase: "idle" }, 0, DEFAULT_MOTION_CONFIG),
    startCapture: () => ({ ok: true }),
    finishCapture: noop,
    resetCapture: noop,
    deleteTrial: noop,
    clearTrials: noop,
    setReference: noop,
    sim: { enabled: false, params: DEFAULT_SIM },
    setSimEnabled: noop,
    setSimParams: noop,
    simAnalysis: null,
    ...overrides,
  };
}

const KINDS: MotionKind[] = ["mru", "mrua"];

// El Dockerfile ejecuta las pruebas sin la carpeta docs/: allí esta comprobación se omite.
const HAS_DOCS = existsSync("docs");

describe("registro de laboratorios", () => {
  it("tiene tres laboratorios con ids únicos, guías en el repositorio y estado", () => {
    expect(LABS.map((lab) => lab.id)).toEqual(["tilt", "mru", "mrua"]);
    expect(new Set(LABS.map((lab) => lab.id)).size).toBe(3);
    for (const lab of LABS) expect(lab.guideUrl).toMatch(/\/blob\/main\/docs\/GUIA-[A-Z]+\.md$/);
    expect(labById("mru").status).toBe("piloto");
    expect(labById("tilt").status).toBe("estable");
    expect(() => labById("otro" as never)).toThrow();
  });

  it("la pantalla Labs muestra las tres tarjetas, el aviso de piloto y las guías", () => {
    const html = renderToStaticMarkup(
      <LabsScreen sensors={sensorsMock()} statusLabel="Sin sensores" trials={{ tilt: [], mru: [trialOf("mru")], mrua: [] }} onOpenLab={noop} onEnable={noop} />,
    );
    expect(html).toContain("Medición de inclinación");
    expect(html).toContain("Movimiento rectilíneo uniforme (MRU)");
    expect(html).toContain("Movimiento uniformemente acelerado (MRUA)");
    expect(html).toContain("Piloto");
    expect(html).toContain("1/3 pruebas guiadas");
    expect(html).toContain("GUIA-MRUA.md");
    expect(html).not.toContain("MRU/MRUA y péndulo");
  });
});

describe("contenido de los laboratorios", () => {
  it.each(KINDS)("%s: cada paso de ciencia apunta a un código real de motionPhysics.ts", (kind) => {
    for (const step of LAB_CONTENT[kind].science) {
      expect(extractRegion(physicsSource, step.region), `${kind}: región ${step.region}`).not.toBe("Código no disponible.");
    }
  });

  it.each(KINDS)("%s: los textos no afirman que el sensor esté calibrado", (kind) => {
    const text = JSON.stringify(LAB_CONTENT[kind]);
    expect(text).not.toMatch(/calibrad[oa]s?\b/i);
  });

  it.each(KINDS)("%s: define pregunta, hipótesis, materiales, procedimiento y archivo de guía", (kind) => {
    const content = LAB_CONTENT[kind];
    expect(content.question.length).toBeGreaterThan(20);
    expect(content.hypothesis.length).toBeGreaterThan(20);
    expect(content.materials.length).toBeGreaterThanOrEqual(3);
    expect(content.procedure.length).toBeGreaterThanOrEqual(4);
  });

  it.skipIf(!HAS_DOCS)("cada laboratorio tiene su guía en docs/", () => {
    for (const lab of LABS) {
      const file = lab.guideUrl.split("/").pop()!;
      expect(existsSync(`docs/${file}`), `falta docs/${file}`).toBe(true);
    }
    for (const kind of KINDS) expect(existsSync(`docs/${LAB_CONTENT[kind].guideFile}`)).toBe(true);
  });
});

describe("introducción", () => {
  it.each(KINDS)("%s: muestra la pregunta, los materiales y el botón para comenzar", (kind) => {
    const html = renderToStaticMarkup(
      <MotionIntro content={LAB_CONTENT[kind]} sensors={sensorsMock()} status={labSensorStatus(sensorsMock(), false)} onStart={noop} onSimulate={noop} onDiagnostics={noop} />,
    );
    expect(html).toContain("Pregunta del experimento");
    expect(html).toContain("Materiales");
    expect(html).toContain("Comenzar experimento");
    expect(html).toContain("Ensayar sin sensores");
  });

  it("explica por qué hace falta HTTPS", () => {
    const sensors = sensorsMock({ capabilities: { ...sensorsMock().capabilities, secureContext: false } });
    const html = renderToStaticMarkup(
      <MotionIntro content={LAB_CONTENT.mru} sensors={sensors} status={labSensorStatus(sensors, false)} onStart={noop} onSimulate={noop} onDiagnostics={noop} />,
    );
    expect(html).toContain("HTTPS");
  });
});

describe("demostración", () => {
  it("MRUA muestra la inclinación medida y MRU la aceleración en el plano", () => {
    const rest = evaluarReposo(syntheticMotion({ durationS: 1.5, thetaDeg: 15, profile: () => 0 }), 11_500);
    const live = { rest, history: [{ tMs: 1, value: 0.12 }, { tMs: 100, value: 0.2 }], atMs: 100, totalSamples: 90, thetaDeg: rest.state === "rest" ? rest.baseline.thetaDeg : null };
    const mrua = renderToStaticMarkup(<MotionDemo lab={labMock("mrua", { live })} content={LAB_CONTENT.mrua} onRegister={noop} onShowScience={noop} onShowResults={noop} />);
    expect(mrua).toContain("Inclinación de la superficie");
    expect(mrua).toContain("15,0°");
    expect(mrua).toContain("Registrar prueba de MRUA");
    const mru = renderToStaticMarkup(<MotionDemo lab={labMock("mru", { live })} content={LAB_CONTENT.mru} onRegister={noop} onShowScience={noop} onShowResults={noop} />);
    expect(mru).toContain("Aceleración en el plano");
    expect(mru).toContain("Registrar prueba de MRU");
    expect(mru).toContain("Cómo hacer la prueba");
  });

  it.each(KINDS)("%s: en simulación muestra controles y resultados, y no deja registrar", (kind) => {
    const simAnalysis = simulateAnalysis(kind, DEFAULT_SIM);
    expect(simAnalysis).not.toBeNull();
    const html = renderToStaticMarkup(
      <MotionDemo lab={labMock(kind, { sim: { enabled: true, params: DEFAULT_SIM }, simAnalysis })} content={LAB_CONTENT[kind]} onRegister={noop} onShowScience={noop} onShowResults={noop} />,
    );
    expect(html).toContain("Simulación");
    expect(html).toContain("type=\"range\"");
    expect(html).toContain("Aceleración a(t)");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Registrar prueba/);
  });

  it("una simulación sin resultado lo avisa", () => {
    const html = renderToStaticMarkup(<MotionDemo lab={labMock("mrua", { sim: { enabled: true, params: DEFAULT_SIM }, simAnalysis: null })} content={LAB_CONTENT.mrua} onRegister={noop} onShowScience={noop} onShowResults={noop} />);
    expect(html).toContain("no produjo un resultado");
  });
});

describe("simulación", () => {
  it("MRU: la velocidad simulada se recupera con el mismo análisis", () => {
    const analysis = simulateAnalysis("mru", { ...DEFAULT_SIM, speed: 1, friction: 0 });
    expect(analysis?.mru?.vCruise).toBeGreaterThan(0.9);
    expect(analysis?.mru?.vCruise).toBeLessThan(1.1);
  });

  it("MRUA: la aceleración sigue g·(sen θ − μ·cos θ)", () => {
    const analysis = simulateAnalysis("mrua", { ...DEFAULT_SIM, thetaDeg: 20, mu: 0.1 });
    const expected = 9.81 * (Math.sin((20 * Math.PI) / 180) - 0.1 * Math.cos((20 * Math.PI) / 180));
    expect(analysis?.mrua?.aMean).toBeGreaterThan(expected * 0.95);
    expect(analysis?.mrua?.aMean).toBeLessThan(expected * 1.05);
    expect(analysis?.mrua?.mu).toBeGreaterThan(0.08);
    expect(analysis?.mrua?.mu).toBeLessThan(0.12);
  });
});

describe("ciencia", () => {
  it.each(KINDS)("%s: lista cada paso con su código, los parámetros y el glosario", (kind) => {
    const trial = trialOf(kind);
    const html = renderToStaticMarkup(<MotionScience lab={labMock(kind, { trials: [trial] })} content={LAB_CONTENT[kind]} />);
    for (const step of LAB_CONTENT[kind].science) expect(html).toContain(step.title);
    expect(html).toContain("Parámetros de LabMotion");
    expect(html).toContain("Glosario");
    expect(html).toContain("integrarMovimiento");
    expect(html).toContain("Última prueba registrada");
    expect(html).toContain("labmotion-motion-1.0.0");
  });

  it("sin pruebas ni simulación avisa que aún no hay datos", () => {
    const html = renderToStaticMarkup(<MotionScience lab={labMock("mru")} content={LAB_CONTENT.mru} />);
    expect(html).toContain("Aún no hay pruebas");
    expect(html).not.toContain("Con los números de la prueba");
  });
});

describe("resultados", () => {
  it.each(KINDS)("%s: sin pruebas muestra el estado vacío", (kind) => {
    const html = renderToStaticMarkup(<MotionResults lab={labMock(kind)} content={LAB_CONTENT[kind]} deviceLabel="Prueba" onRepeat={noop} onMeasure={noop} />);
    expect(html).toContain("Aún no hay pruebas");
  });

  it("MRU: tabla, conclusión, distancia con cinta y exportación", () => {
    const html = renderToStaticMarkup(<MotionResults lab={labMock("mru", { trials: [trialOf("mru", 1)] })} content={LAB_CONTENT.mru} deviceLabel="Prueba" onRepeat={noop} onMeasure={noop} />);
    expect(html).toContain("v (m/s)");
    expect(html).toContain("R² x(t)");
    expect(html).toContain("Conclusión con los datos registrados");
    expect(html).toContain("velocidad de crucero");
    expect(html).toContain("Exportar para el informe");
    expect(html).toContain("CSV de resultados");
    expect(html).toContain("Preguntas para tu informe");
    expect(html).toContain("Distancia estimada");
  });

  it("una prueba sin distancia con cinta ofrece registrarla", () => {
    const html = renderToStaticMarkup(<MotionResults lab={labMock("mru", { trials: [trialOf("mru", 1), trialOf("mru", 2)] })} content={LAB_CONTENT.mru} deviceLabel="Prueba" onRepeat={noop} onMeasure={noop} />);
    expect(html).toContain("Distancia medida con cinta (opcional)");
    expect(html).toContain("Promedio de 2 pruebas");
  });

  it("MRUA: compara con g·sen θ y no afirma calibración", () => {
    const html = renderToStaticMarkup(<MotionResults lab={labMock("mrua", { trials: [trialOf("mrua", 1)] })} content={LAB_CONTENT.mrua} deviceLabel="Prueba" onRepeat={noop} onMeasure={noop} />);
    expect(html).toContain("g·sen θ");
    expect(html).toContain("coeficiente de roce");
    expect(html).toContain("no certifican la calibración");
    expect(html).not.toMatch(/calibrad[oa]s?\b/i);
  });

  it("avisa si el navegador no dejó guardar", () => {
    const html = renderToStaticMarkup(<MotionResults lab={labMock("mru", { trials: [trialOf("mru")], storageOk: false })} content={LAB_CONTENT.mru} deviceLabel="Prueba" onRepeat={noop} onMeasure={noop} />);
    expect(html).toContain("no permitió guardarlas");
  });
});

describe("vista de una prueba", () => {
  it("MRU: cifras, gráficos y datos de la prueba", () => {
    const html = renderToStaticMarkup(<MotionAnalysisView analysis={trialOf("mru").analysis} referenceM={1.4} />);
    expect(html).toContain("Velocidad de crucero");
    expect(html).toContain("Aceleración contra tiempo");
    expect(html).toContain("Posición contra tiempo");
    expect(html).toContain("Con cinta: 1,40 m");
    expect(html).toContain("Deriva corregida");
  });

  it("MRUA: g·sen θ, μ y la alineación con la pendiente", () => {
    const html = renderToStaticMarkup(<MotionAnalysisView analysis={trialOf("mrua").analysis} />);
    expect(html).toContain("g·sen θ (sin roce)");
    expect(html).toContain("Roce estimado");
    expect(html).toContain("Alineación con la pendiente");
  });

  it("muestra los avisos de calidad", () => {
    const analysis = { ...trialOf("mrua").analysis, warnings: ["Frecuencia de muestreo baja (20 Hz)."] };
    expect(renderToStaticMarkup(<MotionAnalysisView analysis={analysis} />)).toContain("Avisos de calidad");
  });
});
