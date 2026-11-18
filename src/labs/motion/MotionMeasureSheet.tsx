import { useEffect, useState } from "react";
import { formatNumber, formatSeconds } from "../../lib/format";
import { BottomSheet, Button, showToast } from "../../ui";
import { Callout, ProgressRing } from "../tilt/TiltParts";
import type { LabContent } from "./motionContent";
import { isValidDistance, nextAttempt, type MotionTrial } from "./motionSession";
import type { MotionLab } from "./useMotionLab";

/** Hoja de registro de una prueba: reposo → preparado → grabando → resultado. */
export function MotionMeasureSheet({
  lab,
  content,
  open,
  onClose,
  replaceTrial,
  sensorsActive,
  onEnableSensors,
  onShowResults,
}: {
  lab: MotionLab;
  content: LabContent;
  open: boolean;
  onClose: () => void;
  replaceTrial: MotionTrial | null;
  sensorsActive: boolean;
  onEnableSensors: () => void;
  onShowResults: () => void;
}) {
  const { capture, trials, live, resetCapture } = lab;
  const [distance, setDistance] = useState("");

  useEffect(() => {
    if (!open) return;
    resetCapture();
    setDistance("");
    // Solo al abrir: los cambios de `trials` durante la medición no deben reiniciar la hoja.
  }, [open]);

  const busy = capture.phase === "resting" || capture.phase === "armed" || capture.phase === "recording";
  const attempt = replaceTrial ? replaceTrial.attempt : nextAttempt(trials);
  const trial = capture.phase === "done" ? capture.trial : null;
  const simulated = lab.sim.enabled;
  const current = live.history.length ? live.history[live.history.length - 1].value : null;

  const close = () => {
    if (busy) resetCapture();
    onClose();
  };
  const start = () => {
    const result = lab.startCapture(replaceTrial?.id ?? null);
    if (!result.ok) showToast(result.reason);
  };
  const parsedDistance = Number(distance.replace(",", "."));
  const distanceValid = distance.trim() !== "" && isValidDistance(parsedDistance);
  const saveDistance = () => {
    if (!trial || !distanceValid) return;
    lab.setReference(trial.id, parsedDistance);
    showToast("Distancia con cinta guardada.");
  };

  return (
    <BottomSheet open={open} onClose={close} title={replaceTrial ? "Repetir prueba" : "Registrar prueba"}>
      <div className="flex flex-col gap-4">
        {simulated && <Callout tone="warning" title="Simulación activa">Desactívala para medir: las pruebas solo aceptan datos reales del sensor.</Callout>}
        {!sensorsActive && !simulated && (
          <Callout tone="warning" title="Sensores inactivos">
            <span className="block">Activa los sensores para registrar una prueba.</span>
            <Button size="sm" className="mt-2" onClick={onEnableSensors}>Activar sensores</Button>
          </Callout>
        )}

        {capture.phase === "idle" && (
          <>
            <p className="m-0 text-caption text-text-secondary">
              Será la <b>Prueba {attempt}</b> (se sugieren 3). {content.position}
            </p>
            <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-caption text-text-secondary">
              {content.procedure.slice(1).map((step) => <li key={step}>{step}</li>)}
            </ol>
            <Button fullWidth onClick={start} disabled={!sensorsActive || simulated}>Preparar</Button>
          </>
        )}

        {capture.phase === "resting" && (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-[16px] bg-warning-soft px-4 py-3">
              <span className="size-5 shrink-0 animate-spin rounded-full border-[3px] border-warning border-t-transparent" aria-hidden="true" />
              <div className="min-w-0">
                <p className="m-0 text-body-medium font-semibold text-text-primary">Midiendo el reposo…</p>
                <p className="m-0 text-micro text-text-secondary">{capture.message}</p>
              </div>
            </div>
            <Button variant="outline" fullWidth onClick={resetCapture}>Cancelar</Button>
          </div>
        )}

        {capture.phase === "armed" && (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="rounded-[16px] bg-success-soft px-4 py-3">
              <p className="eyebrow text-success">Listo{capture.thetaDeg !== null && content.kind === "mrua" ? ` · rampa de ${formatNumber(capture.thetaDeg, 1)}°` : ""}</p>
              <p className="m-0 mt-1 text-body-medium font-semibold text-text-primary">{capture.message}</p>
              <p className="m-0 mt-1 text-micro tabular-nums text-text-secondary">Intensidad ahora: {current === null ? "—" : `${formatNumber(current, 2)} m/s²`}</p>
            </div>
            <Button variant="outline" fullWidth onClick={resetCapture}>Cancelar</Button>
          </div>
        )}

        {capture.phase === "recording" && (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-[16px] bg-success-soft px-4 py-3">
              <ProgressRing value={capture.progress} />
              <div className="min-w-0">
                <p className="m-0 text-body-medium font-semibold text-text-primary">Grabando…</p>
                <p className="m-0 text-micro text-text-secondary">{capture.message}</p>
                <p className="m-0 text-micro tabular-nums text-text-secondary">{formatSeconds(capture.elapsedMs)} / {formatSeconds(lab.config.maxRecordMs)}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={resetCapture}>Cancelar</Button>
              <Button onClick={lab.finishCapture}>Terminar</Button>
            </div>
          </div>
        )}

        {trial && (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="rounded-[16px] bg-success-soft px-4 py-3">
              <p className="eyebrow text-success">Prueba {trial.attempt} registrada</p>
              {trial.analysis.mru && (
                <>
                  <p className="m-0 mt-1 text-[34px] leading-tight font-bold tabular-nums text-text-primary">{formatNumber(trial.analysis.mru.vCruise, 2)} <span className="text-body-lg font-medium text-text-secondary">m/s</span></p>
                  <p className="m-0 text-caption text-text-secondary">
                    velocidad de crucero · varió {formatNumber(trial.analysis.mru.vVariation * 100, 1)} % · R² de x(t) = {formatNumber(trial.analysis.mru.xFit.r2, 3)}
                  </p>
                </>
              )}
              {trial.analysis.mrua && (
                <>
                  <p className="m-0 mt-1 text-[34px] leading-tight font-bold tabular-nums text-text-primary">{formatNumber(trial.analysis.mrua.aMean, 2)} <span className="text-body-lg font-medium text-text-secondary">m/s²</span></p>
                  <p className="m-0 text-caption text-text-secondary">
                    aceleración medida · g·sen θ = {formatNumber(trial.analysis.mrua.aIdeal, 2)} m/s² (θ = {formatNumber(trial.analysis.mrua.thetaDeg, 1)}°) · μ ≈ {formatNumber(trial.analysis.mrua.mu, 2)}
                  </p>
                </>
              )}
            </div>
            {trial.analysis.warnings.length > 0 && (
              <Callout tone="warning" title="Avisos">
                <ul className="m-0 list-disc pl-4">{trial.analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </Callout>
            )}
            <div>
              <label className="block text-caption font-semibold text-text-primary" htmlFor={`distance-${content.kind}`}>Opcional: distancia recorrida medida con cinta</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id={`distance-${content.kind}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={distance}
                  onChange={(event) => setDistance(event.target.value)}
                  placeholder="Ej.: 1,20"
                  className="h-12 w-32 rounded-[12px] border border-border-soft bg-surface px-3 text-body-lg font-semibold tabular-nums outline-none focus:border-accent"
                />
                <span className="text-body-lg font-semibold text-text-secondary">m</span>
                <Button variant="outline" size="sm" onClick={saveDistance} disabled={!distanceValid}>Guardar</Button>
              </div>
              <p className="m-0 mt-1 text-micro text-text-tertiary">
                {content.kind === "mru" ? "Desde donde partió hasta donde quedó, para comparar con la distancia estimada por la app." : "Desde donde lo soltaste hasta el tope, para comparar con la distancia estimada por la app."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={resetCapture}>Medir otra</Button>
              <Button onClick={() => { onClose(); onShowResults(); }}>Ver resultados</Button>
            </div>
          </div>
        )}

        {capture.phase === "failed" && (
          <div className="flex flex-col gap-3">
            <Callout tone="danger" title="No se registró la prueba">{capture.message}</Callout>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={close}>Cerrar</Button>
              <Button onClick={start} disabled={!sensorsActive || simulated}>Reintentar</Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
