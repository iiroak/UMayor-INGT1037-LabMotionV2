import clsx from "clsx";
import { useState } from "react";
import { formatDeg, formatNumber } from "../../lib/format";
import { Button, ChevronRightIcon, FreezeIcon, PlayIcon, ProtractorIcon } from "../../ui";
import { Callout, StatePill } from "./TiltParts";
import { TiltProtractor, TiltRuler } from "./TiltProtractor";
import { describirInclinacion, gravityModeLabel } from "./tiltPhysics";
import { REFERENCE_PRESETS, guidedProgress, type TiltTrial } from "./tiltSession";
import type { TiltLab } from "./useTiltLab";

type Scale = "protractor" | "ruler";

/** Acción secundaria: target táctil de 48 px, texto en una línea en 360 px. */
const SECONDARY_ACTION =
  "flex min-h-12 min-w-0 items-center justify-center gap-1.5 rounded-full border border-border-soft bg-surface px-3 text-[14px] font-semibold whitespace-nowrap transition-[opacity,transform] active:scale-[0.98] active:opacity-75 disabled:opacity-40";

export function TiltDemo({
  lab,
  onRegister,
  onShowScience,
  onShowResults,
}: {
  lab: TiltLab;
  onRegister: (referenceDeg: number | null, replaceId?: string | null) => void;
  onShowScience: () => void;
  onShowResults: () => void;
}) {
  const [scale, setScale] = useState<Scale>("protractor");
  const { view, sim } = lab;
  const reading = view.result?.ok ? view.result.reading : null;
  const theta = reading?.thetaDeg ?? null;
  const simulated = view.source === "sim";
  const frozen = view.source === "frozen";
  const stabilityState = simulated ? "stable" : view.stability.state;
  const explanation = describirInclinacion(theta, stabilityState, lab.config);
  const captureReference = lab.capture.phase === "waiting" || lab.capture.phase === "capturing" ? lab.capture.referenceDeg : null;

  return (
    <div className="flex flex-col gap-3">
      <section className="card card-pad" aria-labelledby="demo-reading">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">{scale === "protractor" ? "Transportador digital" : "Regla angular ampliada"}</p>
          <div className="flex gap-1 rounded-full bg-surface-muted p-1" role="group" aria-label="Escala visual">
            {(["protractor", "ruler"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={scale === option}
                onClick={() => setScale(option)}
                className={clsx(
                  "min-h-9 rounded-full px-3 text-micro font-semibold whitespace-nowrap",
                  scale === option ? "bg-surface text-text-primary shadow-[0_2px_5px_rgba(0,0,0,0.09)]" : "text-text-tertiary",
                )}
              >
                {option === "protractor" ? "0–90°" : "Zoom 1°"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          {scale === "protractor"
            ? <TiltProtractor angleDeg={theta} referenceDeg={captureReference} dimmed={frozen} />
            : <TiltRuler angleDeg={theta} referenceDeg={captureReference} />}
        </div>

        <div className="mt-2 flex flex-col items-center text-center">
          <p className="eyebrow">Inclinación{frozen ? " · lectura congelada" : simulated ? " · simulada" : ""}</p>
          <p
            id="demo-reading"
            className="m-0 font-bold tracking-[-0.04em] text-text-primary tabular-nums text-[clamp(56px,18vw,84px)] leading-[1.02]"
            aria-label={theta === null ? "Sin medición" : `Inclinación ${formatNumber(theta, 1)} grados`}
          >
            {theta === null ? "—" : formatDeg(theta)}
          </p>
          <p className="m-0 mt-1 text-body-lg font-medium text-text-secondary text-balance">{explanation}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <StatePill state={stabilityState} simulated={simulated} />
            {frozen && <span className="state-pill is-neutral"><FreezeIcon size={15} />Congelada</span>}
            {reading && !simulated && (
              <span className={clsx("state-pill", reading.mode === "diferencia" ? "is-neutral" : "is-moving")}>
                {reading.mode === "diferencia" ? gravityModeLabel(reading.mode) : "Estimación en reposo"}
              </span>
            )}
          </div>
          {!simulated && view.stability.state !== "stable" && view.result && (
            <p className="m-0 mt-2 text-micro text-text-tertiary">{view.stability.reason}</p>
          )}
        </div>

        {view.result && !view.result.ok && !simulated && (
          <div className="mt-3">
            <Callout tone="danger" title="No hay lectura confiable">{view.result.detail}</Callout>
          </div>
        )}
        {reading?.mode === "reposo" && !simulated && (
          <div className="mt-3">
            <Callout tone="warning" title="Estimación en reposo">
              Este navegador no entrega la aceleración lineal: se usa a_total como gravedad. Solo es válida con el teléfono quieto.
            </Callout>
          </div>
        )}

        {sim.enabled && (
          <label className="mt-4 block rounded-[16px] bg-warning-soft p-3">
            <span className="flex items-center justify-between text-caption font-semibold text-text-primary">
              Ángulo simulado <span className="tabular-nums">{formatDeg(sim.angleDeg)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={90}
              step={0.5}
              value={sim.angleDeg}
              onChange={(event) => lab.setSimAngle(Number(event.target.value))}
              className="mt-2 w-full accent-[var(--warning)]"
              aria-label="Ángulo simulado en grados"
            />
          </label>
        )}
      </section>

      <Button fullWidth onClick={() => onRegister(null)} disabled={simulated}>Registrar medición</Button>
      <div className="grid grid-cols-2 gap-2">
        {frozen ? (
          <button type="button" className={clsx(SECONDARY_ACTION, "text-text-primary")} onClick={lab.unfreeze}><PlayIcon size={16} />Reanudar</button>
        ) : (
          <button type="button" className={clsx(SECONDARY_ACTION, "text-text-primary")} onClick={lab.freeze} disabled={simulated || !view.result}><FreezeIcon size={18} />Congelar lectura</button>
        )}
        <button type="button" className={clsx(SECONDARY_ACTION, "text-accent-text")} onClick={onShowScience}>
          ¿Cómo se calcula?<ChevronRightIcon size={16} />
        </button>
      </div>
      {simulated && (
        <p className="m-0 px-1 text-micro text-text-secondary">En simulación no se puede congelar ni registrar: las mediciones solo aceptan datos reales del sensor.</p>
      )}

      <GuidedProgress trials={lab.trials} captureMs={lab.config.captureMs} onRegister={onRegister} onShowResults={onShowResults} disabled={simulated} />

      <Callout title="El transportador de la pantalla no es la referencia">
        Solo representa el valor que calcula el teléfono. La comparación independiente la aporta el <strong>transportador físico</strong> con que se ajusta el soporte.
      </Callout>

      <div className="card flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="m-0 text-body-medium font-semibold text-text-primary">Modo simulación</p>
          <p className="m-0 text-micro text-text-tertiary">Para ensayar la exposición en un computador. No genera mediciones.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sim.enabled}
          aria-label="Modo simulación"
          onClick={() => lab.setSimEnabled(!sim.enabled)}
          className={clsx("relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors", sim.enabled ? "bg-warning" : "bg-surface-muted")}
        >
          <span className={clsx("absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.2)] transition-transform", sim.enabled && "translate-x-5")} />
        </button>
      </div>
    </div>
  );
}

function GuidedProgress({
  trials,
  captureMs,
  onRegister,
  onShowResults,
  disabled,
}: {
  trials: TiltTrial[];
  captureMs: number;
  onRegister: (referenceDeg: number | null) => void;
  onShowResults: () => void;
  disabled: boolean;
}) {
  const { done, target } = guidedProgress(trials);
  const custom = trials.filter((trial) => !(REFERENCE_PRESETS as readonly number[]).includes(trial.referenceDeg)).length;
  return (
    <section className="card card-pad" aria-labelledby="guided-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Experimento guiado</p>
          <h3 id="guided-title" className="m-0 mt-1 text-title font-semibold text-text-primary">Compara con un transportador físico</h3>
        </div>
        <span className="count-pill" aria-label={`${done} de ${target} pruebas sugeridas`}>{done}/{target}</span>
      </div>
      <ol className="m-0 mt-3 grid list-none gap-2 p-0 text-caption text-text-secondary">
        <li className="flex gap-2"><b className="w-5 shrink-0 font-mono text-accent-text">1</b>Pantalla hacia arriba sobre una superficie horizontal: debe marcar cerca de 0° y «Estable».</li>
        <li className="flex gap-2"><b className="w-5 shrink-0 font-mono text-accent-text">2</b>Ajusta el soporte al ángulo con el transportador físico (0°, 30°, 45° o 60°).</li>
        <li className="flex gap-2"><b className="w-5 shrink-0 font-mono text-accent-text">3</b>Apoya el teléfono, toca la casilla y suéltalo: tras asentarse se promedian {formatNumber(captureMs / 1000, 0)} s estables.</li>
        <li className="flex gap-2"><b className="w-5 shrink-0 font-mono text-accent-text">4</b>Repite 3 veces por ángulo. Puedes dejar la sesión incompleta.</li>
      </ol>
      <div className="mt-4 grid gap-2">
        {REFERENCE_PRESETS.map((reference) => {
          const list = trials.filter((trial) => trial.referenceDeg === reference).sort((a, b) => a.attempt - b.attempt);
          const byAttempt = new Map(list.map((trial) => [trial.attempt, trial]));
          return (
            <div key={reference} className="grid grid-cols-[52px_repeat(3,minmax(0,1fr))] items-center gap-2">
              <span className="text-body-medium font-semibold tabular-nums text-text-primary">{reference}°</span>
              {[1, 2, 3].map((attempt) => {
                const trial = byAttempt.get(attempt);
                return trial ? (
                  <div key={attempt} className="flex min-h-12 flex-col items-center justify-center rounded-[12px] bg-success-soft px-1 text-center" aria-label={`Prueba ${attempt} de ${reference} grados: ${formatDeg(trial.meanDeg)}`}>
                    <span className="text-[10px] font-bold text-success">P{attempt}</span>
                    <span className="text-caption font-semibold tabular-nums text-text-primary">{formatDeg(trial.meanDeg)}</span>
                  </div>
                ) : (
                  <button
                    key={attempt}
                    type="button"
                    disabled={disabled}
                    onClick={() => onRegister(reference)}
                    className="flex min-h-12 flex-col items-center justify-center rounded-[12px] border border-dashed border-border-soft bg-surface-soft text-center text-text-tertiary active:opacity-70 disabled:opacity-40"
                    aria-label={`Registrar prueba ${attempt} para ${reference} grados`}
                  >
                    <span className="text-[10px] font-bold">P{attempt}</span>
                    <span className="text-caption font-semibold">Medir</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      {custom > 0 && <p className="m-0 mt-3 text-micro text-text-tertiary">Además hay {custom} prueba{custom === 1 ? "" : "s"} con otra referencia.</p>}
      {trials.length > 0 && (
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onShowResults}>
          <ProtractorIcon size={18} />Ver resultados ({trials.length})
        </Button>
      )}
    </section>
  );
}
