import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SensorController } from "../../hooks/useSensors";
import { getSensorCapabilities } from "../../lib/sensors";
import { syntheticSample, syntheticSeries } from "./testUtils";
import { TiltDemo } from "./TiltDemo";
import { labSensorStatus, TiltIntro } from "./TiltIntro";
import { TiltProtractor, TiltRuler } from "./TiltProtractor";
import { TiltResults } from "./TiltResults";
import { TiltScience } from "./TiltScience";
import { DEFAULT_TILT_CONFIG, evaluarEstabilidad, lecturaDeInclinacion, type TiltReading } from "./tiltPhysics";
import { buildTrial, type TiltTrial } from "./tiltSession";
import type { TiltLab, TiltSnapshot } from "./useTiltLab";

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

function liveSnapshot(thetaDeg: number): TiltSnapshot {
  const samples = syntheticSeries(0, 1500, thetaDeg, 0.03);
  const readings: TiltReading[] = samples.flatMap((sample) => {
    const result = lecturaDeInclinacion(sample);
    return result.ok ? [result.reading] : [];
  });
  const last = samples[samples.length - 1];
  return {
    source: "live",
    result: lecturaDeInclinacion(last),
    stability: evaluarEstabilidad(readings, last.tMs),
    history: readings.map((reading) => ({ tMs: reading.tMs, thetaDeg: reading.thetaDeg })),
    atMs: last.tMs,
    totalSamples: samples.length,
    validSamples: readings.length,
  };
}

function trialFor(referenceDeg: number, measuredDeg: number, attempt = 1): TiltTrial {
  const samples = syntheticSeries(0, 2000, measuredDeg, 0.05);
  const readings = samples.flatMap((sample) => {
    const result = lecturaDeInclinacion(sample);
    return result.ok ? [result.reading] : [];
  });
  const result = buildTrial({ referenceDeg, attempt, samples, readings, waitMs: 500, restarts: 0, screenOrientation: "portrait-primary" });
  if (!result.ok) throw new Error(result.reason);
  return result.trial;
}

function labMock(overrides: Partial<TiltLab> = {}): TiltLab {
  const view = liveSnapshot(30);
  return {
    config: DEFAULT_TILT_CONFIG,
    started: true,
    setStarted: noop,
    section: "demo",
    setSection: noop,
    trials: [],
    storageOk: true,
    live: view,
    view,
    frozen: false,
    freeze: noop,
    unfreeze: noop,
    sim: { enabled: false, angleDeg: 30 },
    setSimEnabled: noop,
    setSimAngle: noop,
    capture: { phase: "idle", referenceDeg: null, replaceId: null, progress: 0, elapsedMs: 0, restarts: 0, message: "", trial: null },
    startCapture: () => ({ ok: true as const }),
    resetCapture: noop,
    deleteTrial: noop,
    clearTrials: noop,
    ...overrides,
  } as TiltLab;
}

describe("TiltProtractor", () => {
  it("expone el ángulo para lectores de pantalla y dibuja la escala 0–90°", () => {
    const html = renderToStaticMarkup(<TiltProtractor angleDeg={30} />);
    expect(html).toContain("Transportador digital marcando 30,0°");
    expect(html).toContain(">0°<");
    expect(html).toContain(">90°<");
    expect(html).toContain(">40<");
  });

  it("sin lectura no dibuja un 0° falso", () => {
    const html = renderToStaticMarkup(<TiltProtractor angleDeg={null} />);
    expect(html).toContain("Sin medición");
    expect(html).not.toContain("marcando");
    expect(html).toContain('visibility="hidden"');
  });

  it("muestra la referencia física ingresada como línea punteada", () => {
    expect(renderToStaticMarkup(<TiltProtractor angleDeg={31} referenceDeg={30} />)).toContain("reference-line");
    expect(renderToStaticMarkup(<TiltProtractor angleDeg={31} />)).not.toContain("reference-line");
  });

  it("la regla ampliada usa la misma lectura", () => {
    expect(renderToStaticMarkup(<TiltRuler angleDeg={45.25} />)).toContain("marcando 45,3°");
  });
});

describe("TiltIntro", () => {
  it("pide permiso desde un botón y muestra el estado", () => {
    const sensors = sensorsMock();
    const html = renderToStaticMarkup(<TiltIntro sensors={sensors} status={labSensorStatus(sensors, false)} onStart={noop} onSimulate={noop} onDiagnostics={noop} />);
    expect(html).toContain("Comenzar experimento");
    expect(html).toContain("Solicitar permiso");
    expect(html).toContain("transportador");
  });

  it("explica el problema si no hay HTTPS o se rechazó el permiso", () => {
    const insecure = sensorsMock({ capabilities: { ...getSafeCapabilities(), secureContext: false } });
    expect(labSensorStatus(insecure, false).label).toBe("Se requiere HTTPS");
    const denied = sensorsMock({ state: "denied" });
    const html = renderToStaticMarkup(<TiltIntro sensors={denied} status={labSensorStatus(denied, false)} onStart={noop} onSimulate={noop} onDiagnostics={noop} />);
    expect(html).toContain("Permiso rechazado");
    expect(html).toContain("Diagnóstico");
  });

  it("distingue «Sin datos» de «Se perdió la señal»", () => {
    expect(labSensorStatus(sensorsMock({ state: "active", signal: "lost" }), false).label).toBe("Sin datos");
    expect(labSensorStatus(sensorsMock({ state: "active", signal: "lost", latest: syntheticSample(0, 0) }), false).label).toBe("Se perdió la señal");
    expect(labSensorStatus(sensorsMock({ state: "active", signal: "receiving", latest: syntheticSample(0, 0) }), true).label).toBe("Listo");
    expect(labSensorStatus(sensorsMock({ state: "unsupported" }), false).label).toBe("No compatible");
  });
});

function getSafeCapabilities() {
  // En Node no existe window: se usan capacidades fijas.
  return typeof window === "undefined" ? sensorsMock().capabilities : getSensorCapabilities();
}

describe("TiltDemo", () => {
  it("muestra cifra grande, estado y acciones con datos reales", () => {
    const html = renderToStaticMarkup(<TiltDemo lab={labMock()} onRegister={noop} onShowScience={noop} onShowResults={noop} />);
    expect(html).toContain("30,0°");
    expect(html).toContain("Estable");
    expect(html).toContain("Congelar lectura");
    expect(html).toContain("Registrar medición");
    expect(html).toContain("¿Cómo se calcula?");
    expect(html).toContain("no es la referencia");
  });

  it("en simulación lo rotula y bloquea el registro", () => {
    const lab = labMock({ sim: { enabled: true, angleDeg: 45 }, view: { ...liveSnapshot(45), source: "sim" } });
    const html = renderToStaticMarkup(<TiltDemo lab={lab} onRegister={noop} onShowScience={noop} onShowResults={noop} />);
    expect(html).toContain("Simulación");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Registrar medición<\/button>/);
  });

  it("sin lectura confiable no muestra un número", () => {
    const sample = { ...syntheticSample(0, 0), accelerationIncludingGravity: { x: null, y: null, z: null } };
    const view: TiltSnapshot = { ...liveSnapshot(10), result: lecturaDeInclinacion(sample), stability: { ...liveSnapshot(10).stability, state: "insufficient" } };
    const html = renderToStaticMarkup(<TiltDemo lab={labMock({ view, live: view })} onRegister={noop} onShowScience={noop} onShowResults={noop} />);
    expect(html).toContain("No hay lectura confiable");
    expect(html).toContain("Señal insuficiente");
    expect(html).toContain(">—<");
  });
});

describe("TiltScience", () => {
  it("muestra la cadena de cálculo con los números de la lectura y su origen", () => {
    const html = renderToStaticMarkup(<TiltScience lab={labMock()} frequencyHz={60} />);
    expect(html).toContain("Medición entregada");
    expect(html).toContain("Magnitud derivada");
    expect(html).toContain("θ = atan2(√(gx² + gy²), |gz|) × 180/π");
    expect(html).toMatch(/θ = atan2\(4,9\d, 8,4\d\) = 30,0\d°/);
    expect(html).toContain("inclinacionDeSuperficie");
  });
});

describe("TiltResults", () => {
  it("sin pruebas invita a medir", () => {
    const html = renderToStaticMarkup(<TiltResults lab={labMock()} diagnostics={null as never} deviceLabel="test" onRepeat={noop} onMeasure={noop} />);
    expect(html).toContain("Aún no hay mediciones");
  });

  it("con pruebas muestra tabla, estado, conclusión y exportación", () => {
    const trials = [trialFor(0, 0.5), trialFor(30, 31.2), trialFor(30, 30.6, 2)];
    const html = renderToStaticMarkup(<TiltResults lab={labMock({ trials })} diagnostics={null as never} deviceLabel="test" onRepeat={noop} onMeasure={noop} />);
    expect(html).toContain("Registro por referencia");
    expect(html).toContain("% no aplica");
    expect(html).toContain("Para una referencia de 30°");
    expect(html).toContain("¿Por qué no coincide exactamente?");
    expect(html).toContain("Exportar JSON");
    expect(html).toContain("CSV de resultados");
    expect(html).toContain("Copiar resumen para el informe");
    expect(html).toContain("Referencia del transportador físico");
  });
});
