import { useEffect, useRef, useState } from "react";
import type { SensorController } from "../../hooks/useSensors";
import { AlertIcon, SegmentedControl, showToast } from "../../ui";
import { SensorStatusBadge, labSensorStatus } from "../tilt/TiltIntro";
import { MotionDemo } from "./MotionDemo";
import { MotionIntro } from "./MotionIntro";
import { MotionMeasureSheet } from "./MotionMeasureSheet";
import { MotionResults } from "./MotionResults";
import { MotionScience } from "./MotionScience";
import { LAB_CONTENT } from "./motionContent";
import type { MotionTrial } from "./motionSession";
import type { MotionLab as MotionLabState, MotionSection } from "./useMotionLab";

/**
 * Laboratorio de movimiento rectilíneo (MRU o MRUA). Demostración, Ciencia y
 * Resultados leen el mismo estado: cambiar de vista no reinicia sensores ni pierde pruebas.
 */
export function MotionLab({
  lab,
  sensors,
  deviceLabel,
  onDiagnostics,
}: {
  lab: MotionLabState;
  sensors: SensorController;
  deviceLabel: string;
  onDiagnostics: () => void;
}) {
  const content = LAB_CONTENT[lab.kind];
  const [sheet, setSheet] = useState<{ open: boolean; replace: MotionTrial | null }>({ open: false, replace: null });
  const status = labSensorStatus(sensors, lab.live.rest.state !== "insufficient");

  // Al pasar de la introducción al laboratorio (o cambiar de vista), volver arriba.
  const viewKey = `${lab.started}:${lab.section}`;
  const previousKey = useRef(viewKey);
  useEffect(() => {
    if (previousKey.current !== viewKey) document.getElementById("app-scroll-area")?.scrollTo({ top: 0 });
    previousKey.current = viewKey;
  }, [viewKey]);

  const simulated = lab.sim.enabled;
  const start = async () => {
    const ok = await sensors.enable();
    if (ok) {
      lab.setSimEnabled(false);
      lab.setStarted(true);
    }
  };
  const openSheet = (replace: MotionTrial | null = null) => {
    if (simulated) {
      showToast("Desactiva la simulación para registrar pruebas reales.");
      return;
    }
    setSheet({ open: true, replace });
  };

  return (
    <div className="flex flex-col">
      {simulated && (
        <div className="sim-banner" role="alert">
          <AlertIcon size={18} />Simulación — no son datos reales
        </div>
      )}
      <div className="px-[18px] pt-4 pb-6">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 className="screen-title">{content.title}</h1>
        <p className="m-0 mt-1.5 text-body text-text-secondary">{content.subtitle}</p>

        {!lab.started ? (
          <div className="mt-5">
            <MotionIntro
              content={content}
              sensors={sensors}
              status={status}
              onStart={() => void start()}
              onSimulate={() => { lab.setSimEnabled(true); lab.setStarted(true); }}
              onDiagnostics={onDiagnostics}
            />
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              {simulated ? <span className="state-pill is-moving"><AlertIcon size={15} />Sin sensores</span> : <SensorStatusBadge status={status} />}
              {!simulated && sensors.state !== "active" && (
                <button type="button" className="min-h-9 rounded-full bg-fab px-4 text-caption font-semibold text-fab-content" onClick={() => void start()}>Activar sensores</button>
              )}
              {!simulated && sensors.state === "active" && status.tone === "bad" && (
                <button type="button" className="min-h-9 rounded-full px-2 text-caption font-semibold text-accent-text underline-offset-4 hover:underline" onClick={onDiagnostics}>Abrir diagnóstico</button>
              )}
              {simulated && (
                <button type="button" className="min-h-9 rounded-full px-2 text-caption font-semibold text-accent-text underline-offset-4 hover:underline" onClick={() => lab.setSimEnabled(false)}>Salir de la simulación</button>
              )}
            </div>
            <SegmentedControl<MotionSection>
              className={`sticky z-10 mt-3 shadow-[0_4px_12px_rgba(248,248,250,0.9)] ${simulated ? "top-[42px]" : "top-0"}`}
              ariaLabel="Vista del laboratorio"
              value={lab.section}
              onChange={lab.setSection}
              options={[
                { value: "demo", label: "Demostración" },
                { value: "science", label: "Ciencia" },
                { value: "results", label: lab.trials.length ? `Resultados (${lab.trials.length})` : "Resultados" },
              ]}
            />
            <div className="mt-4">
              {lab.section === "demo" && (
                <MotionDemo lab={lab} content={content} onRegister={() => openSheet()} onShowScience={() => lab.setSection("science")} onShowResults={() => lab.setSection("results")} />
              )}
              {lab.section === "science" && <MotionScience lab={lab} content={content} />}
              {lab.section === "results" && (
                <MotionResults
                  lab={lab}
                  content={content}
                  deviceLabel={deviceLabel}
                  onRepeat={(trial) => openSheet(trial)}
                  onMeasure={() => { lab.setSection("demo"); openSheet(); }}
                />
              )}
            </div>
          </>
        )}
      </div>
      <MotionMeasureSheet
        lab={lab}
        content={content}
        open={sheet.open}
        onClose={() => setSheet((current) => ({ ...current, open: false }))}
        replaceTrial={sheet.replace}
        sensorsActive={sensors.state === "active"}
        onEnableSensors={() => void start()}
        onShowResults={() => lab.setSection("results")}
      />
    </div>
  );
}
