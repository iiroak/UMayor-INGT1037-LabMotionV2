import { useEffect, useRef, useState } from "react";
import type { SensorController } from "../../hooks/useSensors";
import type { Diagnostics } from "../../lib/diagnostics";
import { AlertIcon, SegmentedControl, showToast } from "../../ui";
import { TiltDemo } from "./TiltDemo";
import { SensorStatusBadge, TiltIntro, labSensorStatus } from "./TiltIntro";
import { TiltMeasureSheet } from "./TiltMeasureSheet";
import { TiltResults } from "./TiltResults";
import { TiltScience } from "./TiltScience";
import type { TiltTrial } from "./tiltSession";
import type { TiltLab as TiltLabState, TiltSection } from "./useTiltLab";

/**
 * Laboratorio «Medición de inclinación». Demostración, Ciencia y Resultados
 * leen el mismo estado (`lab.view`, `lab.trials`): cambiar de vista no
 * reinicia sensores ni pierde mediciones.
 */
export function TiltLab({
  lab,
  sensors,
  diagnostics,
  deviceLabel,
  onDiagnostics,
}: {
  lab: TiltLabState;
  sensors: SensorController;
  diagnostics: Diagnostics;
  deviceLabel: string;
  onDiagnostics: () => void;
}) {
  const [sheet, setSheet] = useState<{ open: boolean; reference: number | null; replace: TiltTrial | null }>({ open: false, reference: null, replace: null });
  const status = labSensorStatus(sensors, lab.live.result?.ok ?? false);

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

  const openSheet = (reference: number | null, replace: TiltTrial | null = null) => {
    if (simulated) {
      showToast("Desactiva la simulación para registrar mediciones reales.");
      return;
    }
    setSheet({ open: true, reference, replace });
  };

  return (
    <div className="flex flex-col">
      {simulated && (
        <div className="sim-banner" role="alert">
          <AlertIcon size={18} />Simulación — no son datos reales
        </div>
      )}
      <div className="px-[18px] pt-4 pb-6">
        <p className="eyebrow">Laboratorio · Inclinación</p>
        <h1 className="screen-title">¿Qué tan inclinado está tu teléfono?</h1>
        <p className="m-0 mt-1.5 text-body text-text-secondary">Conviértelo en un instrumento para medir ángulos.</p>

        {!lab.started ? (
          <div className="mt-5">
            <TiltIntro
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
            </div>
            <SegmentedControl<TiltSection>
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
                <TiltDemo
                  lab={lab}
                  onRegister={(reference) => openSheet(reference)}
                  onShowScience={() => lab.setSection("science")}
                  onShowResults={() => lab.setSection("results")}
                />
              )}
              {lab.section === "science" && <TiltScience lab={lab} frequencyHz={sensors.frequencyHz} />}
              {lab.section === "results" && (
                <TiltResults
                  lab={lab}
                  diagnostics={diagnostics}
                  deviceLabel={deviceLabel}
                  onRepeat={(trial) => openSheet(trial.referenceDeg, trial)}
                  onMeasure={() => { lab.setSection("demo"); openSheet(null); }}
                />
              )}
            </div>
          </>
        )}
      </div>

      <TiltMeasureSheet
        lab={lab}
        open={sheet.open}
        onClose={() => setSheet((current) => ({ ...current, open: false }))}
        initialReference={sheet.reference}
        replaceTrial={sheet.replace}
        sensorsActive={sensors.state === "active"}
        onEnableSensors={() => void start()}
        onShowResults={() => lab.setSection("results")}
      />
    </div>
  );
}
