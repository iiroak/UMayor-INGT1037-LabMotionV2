import clsx from "clsx";
import { useMemo } from "react";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { formatDeg, formatNumber } from "../../lib/format";
import { AlertIcon, Button, CheckIcon } from "../../ui";
import { Callout, Disclosure } from "../tilt/TiltParts";
import { MotionAnalysisView } from "./MotionAnalysisView";
import type { LabContent } from "./motionContent";
import type { MotionLab } from "./useMotionLab";

function RestPill({ state, simulated }: { state: "rest" | "moving" | "insufficient"; simulated: boolean }) {
  if (simulated) return <span className="state-pill is-moving"><AlertIcon size={15} />Simulación</span>;
  const label = state === "rest" ? "Quieto" : state === "moving" ? "En movimiento" : "Sin datos suficientes";
  return (
    <span className={clsx("state-pill", state === "rest" ? "is-stable" : state === "moving" ? "is-moving" : "is-insufficient")}>
      {state === "rest" ? <CheckIcon size={15} /> : state === "moving" ? <span aria-hidden="true" className="text-[15px] leading-none">≈</span> : <AlertIcon size={15} />}
      {label}
    </span>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-caption">
        <span className="font-semibold text-text-primary">{label}</span>
        <span className="tabular-nums text-text-secondary">{formatNumber(value, step < 0.1 ? 2 : 1)} {unit}</span>
      </span>
      <input type="range" className="mt-1 w-full" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

/** Demostración: lectura en vivo, procedimiento y simulación. */
export function MotionDemo({
  lab,
  content,
  onRegister,
  onShowScience,
  onShowResults,
}: {
  lab: MotionLab;
  content: LabContent;
  onRegister: () => void;
  onShowScience: () => void;
  onShowResults: () => void;
}) {
  const { live, sim, simAnalysis } = lab;
  const simulated = sim.enabled;
  const points = useMemo(() => {
    const end = live.history.length ? live.history[live.history.length - 1].tMs : 0;
    return live.history.map((point) => ({ x: (point.tMs - end) / 1000, y: point.value }));
  }, [live.history]);
  const current = live.history.length ? live.history[live.history.length - 1].value : null;

  return (
    <div className="flex flex-col gap-3">
      {!simulated && (
        <section className="card card-pad" aria-labelledby={`live-${content.kind}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{content.kind === "mrua" ? "Inclinación de la superficie" : "Aceleración en el plano"}</p>
              <p id={`live-${content.kind}`} className="m-0 text-[34px] leading-tight font-bold tabular-nums text-text-primary">
                {content.kind === "mrua" ? formatDeg(live.thetaDeg) : current === null ? "—" : `${formatNumber(current, 2)} m/s²`}
              </p>
              <p className="m-0 text-caption text-text-secondary">
                {live.rest.state === "rest" ? "El teléfono está quieto: listo para preparar la prueba." : live.rest.reason}
              </p>
            </div>
            <RestPill state={live.rest.state} simulated={false} />
          </div>
          <div className="mt-3">
            <TimeSeriesChart
              series={[{ label: "intensidad", color: "#3a83f7", points, maxGap: 0.3 }]}
              yLabel="|a| (m/s²)"
              xLabel="segundos hasta ahora"
              height={150}
              ariaLabel="Intensidad de la aceleración en el plano, en vivo"
            />
          </div>
        </section>
      )}

      {simulated && (
        <section className="card card-pad" aria-labelledby={`sim-${content.kind}`}>
          <div className="flex items-center justify-between gap-2">
            <h3 id={`sim-${content.kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Simulación</h3>
            <RestPill state="rest" simulated />
          </div>
          <p className="m-0 mt-1 text-micro text-text-tertiary">Una señal sintética con ruido leve pasa por el mismo cálculo que una prueba real. No se guarda ni se exporta.</p>
          <div className="mt-3 flex flex-col gap-3">
            {content.kind === "mru" ? (
              <>
                <Slider label="Velocidad de crucero" value={sim.params.speed} min={0.3} max={1.5} step={0.05} unit="m/s" onChange={(speed) => lab.setSimParams({ speed })} />
                <Slider label="Roce durante el crucero" value={sim.params.friction} min={0} max={0.4} step={0.01} unit="m/s²" onChange={(friction) => lab.setSimParams({ friction })} />
              </>
            ) : (
              <>
                <Slider label="Inclinación de la rampa" value={sim.params.thetaDeg} min={5} max={40} step={1} unit="°" onChange={(thetaDeg) => lab.setSimParams({ thetaDeg })} />
                <Slider label="Coeficiente de roce μ" value={sim.params.mu} min={0} max={0.3} step={0.01} unit="" onChange={(mu) => lab.setSimParams({ mu })} />
              </>
            )}
          </div>
        </section>
      )}

      {simulated && (simAnalysis ? <MotionAnalysisView analysis={simAnalysis} /> : <Callout tone="warning" title="La simulación no produjo un resultado">Prueba con otros valores.</Callout>)}

      <section className="card card-pad" aria-labelledby={`how-${content.kind}`}>
        <h3 id={`how-${content.kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Cómo hacer la prueba</h3>
        <ol className="m-0 mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-body text-text-secondary">
          {content.procedure.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="mt-2 border-t border-divider pt-1">
          <Disclosure summary="Consejos para que salga bien">
            <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-caption text-text-secondary">
              {content.tips.map((tip) => <li key={tip}>{tip}</li>)}
            </ul>
          </Disclosure>
        </div>
        <Button className="mt-3" fullWidth onClick={onRegister} disabled={simulated}>{content.registerLabel}</Button>
        {simulated && <p className="m-0 mt-2 text-micro text-text-tertiary">Desactiva la simulación para registrar pruebas con datos reales.</p>}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onShowScience}>Ver cómo se calcula</Button>
        <Button variant="outline" size="sm" onClick={onShowResults}>{lab.trials.length ? `Resultados (${lab.trials.length})` : "Resultados"}</Button>
      </div>
    </div>
  );
}
