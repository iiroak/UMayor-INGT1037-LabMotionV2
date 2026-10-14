import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { formatDeg, formatNumber, formatPercent, formatSeconds } from "../../lib/format";
import { BottomSheet, Button, showToast } from "../../ui";
import { Callout, ProgressRing, StatePill } from "./TiltParts";
import { isValidReference, nextAttempt, REFERENCE_PRESETS, REPETITIONS_TARGET, type TiltTrial } from "./tiltSession";
import type { TiltLab } from "./useTiltLab";

type Choice = { kind: "preset"; value: number } | { kind: "other"; text: string };

function defaultReference(trials: TiltTrial[]): number {
  return REFERENCE_PRESETS.find((reference) => trials.filter((trial) => trial.referenceDeg === reference).length < REPETITIONS_TARGET) ?? REFERENCE_PRESETS[0];
}

function parseReference(choice: Choice): number | null {
  if (choice.kind === "preset") return choice.value;
  const value = Number(choice.text.replace(",", "."));
  return choice.text.trim() !== "" && isValidReference(value) ? value : null;
}

export function TiltMeasureSheet({
  lab,
  open,
  onClose,
  initialReference,
  replaceTrial,
  sensorsActive,
  onEnableSensors,
  onShowResults,
}: {
  lab: TiltLab;
  open: boolean;
  onClose: () => void;
  initialReference: number | null;
  replaceTrial: TiltTrial | null;
  sensorsActive: boolean;
  onEnableSensors: () => void;
  onShowResults: () => void;
}) {
  const [choice, setChoice] = useState<Choice>({ kind: "preset", value: 0 });
  const { capture, view, trials, resetCapture } = lab;

  // Al abrir: referencia sugerida y estado limpio.
  useEffect(() => {
    if (!open) return;
    const reference = replaceTrial?.referenceDeg ?? initialReference ?? defaultReference(trials);
    setChoice((REFERENCE_PRESETS as readonly number[]).includes(reference) ? { kind: "preset", value: reference } : { kind: "other", text: String(reference) });
    resetCapture();
    // Solo al abrir: los cambios de `trials` durante la medición no deben reiniciar la hoja.
  }, [open]);

  const reference = parseReference(choice);
  const busy = capture.phase === "waiting" || capture.phase === "capturing";
  const attempt = useMemo(() => {
    if (reference === null) return null;
    if (replaceTrial && replaceTrial.referenceDeg === reference) return replaceTrial.attempt;
    return nextAttempt(trials.filter((trial) => trial.id !== replaceTrial?.id), reference);
  }, [reference, replaceTrial, trials]);

  const close = () => {
    if (busy) resetCapture();
    onClose();
  };

  const start = () => {
    if (reference === null) return;
    const result = lab.startCapture(reference, replaceTrial?.id ?? null);
    if (!result.ok) showToast(result.reason);
  };

  const reading = view.result?.ok ? view.result.reading : null;
  const simulated = lab.sim.enabled;
  const trial = capture.phase === "done" ? capture.trial : null;

  return (
    <BottomSheet open={open} onClose={close} title={replaceTrial ? "Repetir prueba" : "Registrar medición"}>
      <div className="flex flex-col gap-4">
        {simulated && (
          <Callout tone="warning" title="Simulación activa">Desactívala para medir: las pruebas solo aceptan datos reales del sensor.</Callout>
        )}
        {!sensorsActive && !simulated && (
          <Callout tone="warning" title="Sensores inactivos">
            <span className="block">Activa los sensores para registrar una prueba.</span>
            <Button size="sm" className="mt-2" onClick={onEnableSensors}>Activar sensores</Button>
          </Callout>
        )}

        <fieldset className="m-0 border-0 p-0" disabled={busy}>
          <legend className="mb-2 text-caption font-semibold text-text-primary">Ángulo del transportador físico</legend>
          <div className="flex flex-wrap gap-2">
            {REFERENCE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={clsx("chip min-w-[58px]", choice.kind === "preset" && choice.value === preset && "is-on")}
                aria-pressed={choice.kind === "preset" && choice.value === preset}
                onClick={() => setChoice({ kind: "preset", value: preset })}
              >
                {preset}°
              </button>
            ))}
            <button
              type="button"
              className={clsx("chip", choice.kind === "other" && "is-on")}
              aria-pressed={choice.kind === "other"}
              onClick={() => setChoice({ kind: "other", text: choice.kind === "other" ? choice.text : "" })}
            >
              Otro
            </button>
          </div>
          {choice.kind === "other" && (
            <label className="mt-3 flex items-center gap-2">
              <span className="sr-only">Ángulo de referencia en grados</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={90}
                step={0.5}
                autoFocus
                value={choice.text}
                onChange={(event) => setChoice({ kind: "other", text: event.target.value })}
                placeholder="Ej.: 15"
                className="h-12 w-32 rounded-[12px] border border-border-soft bg-surface px-3 text-body-lg font-semibold tabular-nums outline-none focus:border-accent"
              />
              <span className="text-body-lg font-semibold text-text-secondary">°</span>
              {choice.text !== "" && reference === null && <span className="text-micro text-danger">Entre 0 y 90</span>}
            </label>
          )}
          <p className="m-0 mt-2 text-micro text-text-tertiary">
            {reference === null
              ? "Ingresa la referencia para continuar."
              : replaceTrial
                ? `Reemplazará la Prueba ${replaceTrial.attempt} de ${formatDeg(replaceTrial.referenceDeg, 0)} solo si la nueva medición termina bien.`
                : `Será la Prueba ${attempt} para ${formatDeg(reference, reference % 1 === 0 ? 0 : 1)} (se sugieren ${REPETITIONS_TARGET}).`}
          </p>
        </fieldset>

        <div className="soft-panel flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="eyebrow">Lectura actual</p>
            <p className="m-0 text-[34px] leading-tight font-bold tabular-nums text-text-primary">{reading ? formatDeg(reading.thetaDeg) : "—"}</p>
          </div>
          <StatePill state={view.stability.state} simulated={view.source === "sim"} />
        </div>

        {capture.phase === "idle" && (
          <>
            <p className="m-0 text-caption text-text-secondary">
              Ajusta el soporte <b>con el transportador físico</b> (no con la pantalla), apoya el teléfono con la pantalla hacia arriba y suéltalo. LabMotion descarta {formatSeconds(lab.config.settleMs)} tras el toque, espera «Estable» y promedia {formatSeconds(lab.config.captureMs, 0)}.
            </p>
            <Button fullWidth onClick={start} disabled={reference === null || !sensorsActive || simulated}>Medir cuando esté estable</Button>
          </>
        )}

        {capture.phase === "waiting" && (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-[16px] bg-warning-soft px-4 py-3">
              <span className="size-5 shrink-0 animate-spin rounded-full border-[3px] border-warning border-t-transparent" aria-hidden="true" />
              <div className="min-w-0">
                <p className="m-0 text-body-medium font-semibold text-text-primary">Esperando estabilidad…</p>
                <p className="m-0 text-micro text-text-secondary">{capture.message}{capture.restarts > 0 ? ` · reinicios: ${capture.restarts}` : ""}</p>
              </div>
            </div>
            <Button variant="outline" fullWidth onClick={resetCapture}>Cancelar</Button>
          </div>
        )}

        {capture.phase === "capturing" && (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="flex items-center gap-3 rounded-[16px] bg-success-soft px-4 py-3">
              <ProgressRing value={capture.progress} />
              <div className="min-w-0">
                <p className="m-0 text-body-medium font-semibold text-text-primary">Midiendo — no toques el teléfono</p>
                <p className="m-0 text-micro tabular-nums text-text-secondary">{formatNumber(capture.elapsedMs / 1000, 1)} / {formatNumber(lab.config.captureMs / 1000, 1)} s estables</p>
              </div>
            </div>
            <Button variant="outline" fullWidth onClick={resetCapture}>Cancelar</Button>
          </div>
        )}

        {trial && (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <div className="rounded-[16px] bg-success-soft px-4 py-3">
              <p className="eyebrow text-success">Prueba {trial.attempt} · referencia {formatDeg(trial.referenceDeg, trial.referenceDeg % 1 === 0 ? 0 : 1)}</p>
              <p className="m-0 mt-1 text-[34px] leading-tight font-bold tabular-nums text-text-primary">{formatDeg(trial.meanDeg)}</p>
              <dl className="m-0 mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
                <dt className="text-text-secondary">Diferencia</dt><dd className="m-0 text-right font-semibold tabular-nums">{formatDeg(trial.absErrorDeg)}</dd>
                <dt className="text-text-secondary">Error %</dt><dd className="m-0 text-right font-semibold tabular-nums">{trial.percentError === null ? "No aplica (ref. 0°)" : formatPercent(trial.percentError)}</dd>
                <dt className="text-text-secondary">Dispersión σ</dt><dd className="m-0 text-right tabular-nums">{formatDeg(trial.stdDeg, 2)}</dd>
                <dt className="text-text-secondary">Muestras · duración</dt><dd className="m-0 text-right tabular-nums">{trial.validSamples} · {formatSeconds(trial.durationMs)}</dd>
              </dl>
            </div>
            {trial.warnings.length > 0 && (
              <Callout tone="warning" title="Advertencias">
                <ul className="m-0 list-disc pl-4">{trial.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </Callout>
            )}
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
              <Button onClick={start} disabled={reference === null || !sensorsActive || simulated}>Reintentar</Button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
