import clsx from "clsx";
import { useMemo, useState } from "react";
import { copyText, downloadBlob, fileStamp } from "../../lib/export";
import { formatDateTime, formatNumber } from "../../lib/format";
import { AlertIcon, Button, CheckIcon, CopyIcon, DownloadIcon, EmptyStateCard, FlaskIcon, RestartIcon, TrashIcon, confirmAction, showToast } from "../../ui";
import { Callout } from "../tilt/TiltParts";
import { MotionAnalysisView } from "./MotionAnalysisView";
import type { LabContent } from "./motionContent";
import { samplesCsv, sessionJson, trialsCsv } from "./motionExport";
import { buildConclusion, isValidDistance, referenceComparison, reportSummary, summarize, type MotionTrial } from "./motionSession";
import type { MotionLab } from "./useMotionLab";

const FILE_PREFIX = { mru: "mru", mrua: "mrua" } as const;

export function MotionResults({
  lab,
  content,
  deviceLabel,
  onRepeat,
  onMeasure,
}: {
  lab: MotionLab;
  content: LabContent;
  deviceLabel: string;
  onRepeat: (trial: MotionTrial) => void;
  onMeasure: () => void;
}) {
  const { trials, kind } = lab;
  const ordered = useMemo(() => [...trials].sort((a, b) => a.attempt - b.attempt), [trials]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [distance, setDistance] = useState("");
  const selected = ordered.find((trial) => trial.id === selectedId) ?? ordered[ordered.length - 1] ?? null;
  const summary = useMemo(() => summarize(kind, trials), [kind, trials]);
  const conclusion = useMemo(() => buildConclusion(kind, trials), [kind, trials]);

  if (trials.length === 0) {
    return (
      <EmptyStateCard
        icon={<FlaskIcon size={30} className="text-text-tertiary" />}
        title="Aún no hay pruebas"
        description="Registra al menos una prueba para ver la tabla, los gráficos y la conclusión."
        action={<Button onClick={onMeasure}>{content.registerLabel}</Button>}
      />
    );
  }

  const prefix = FILE_PREFIX[kind];
  const exportCsv = () => downloadBlob(trialsCsv(kind, trials), `labmotion-${prefix}-resultados-${fileStamp()}.csv`, "text/csv;charset=utf-8");
  const exportSamples = () => downloadBlob(samplesCsv(kind, trials), `labmotion-${prefix}-series-${fileStamp()}.csv`, "text/csv;charset=utf-8");
  const exportJson = () => downloadBlob(sessionJson(kind, trials, { device: deviceLabel }), `labmotion-${prefix}-${fileStamp()}.json`, "application/json;charset=utf-8");
  const copySummary = async () => {
    const copied = await copyText(reportSummary(kind, trials, { device: deviceLabel }));
    showToast(copied ? "Resumen copiado. Pégalo en el informe." : "No se pudo copiar el resumen.");
  };
  const removeTrial = async (trial: MotionTrial) => {
    const ok = await confirmAction({
      title: `¿Eliminar la Prueba ${trial.attempt}?`,
      message: "Se borran también sus datos de este navegador.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    lab.deleteTrial(trial.id);
    setSelectedId(null);
    showToast("Prueba eliminada.");
  };
  const repeatTrial = async (trial: MotionTrial) => {
    const ok = await confirmAction({
      title: `¿Repetir la Prueba ${trial.attempt}?`,
      message: "La prueba actual solo se reemplaza si la nueva termina correctamente.",
      confirmLabel: "Repetir",
    });
    if (ok) onRepeat(trial);
  };
  const clearAll = async () => {
    const ok = await confirmAction({
      title: "¿Borrar todas las pruebas?",
      message: `Se eliminarán ${trials.length} pruebas de este navegador. Exporta antes si las necesitas.`,
      confirmLabel: "Borrar todo",
      destructive: true,
    });
    if (!ok) return;
    lab.clearTrials();
    showToast("Sesión borrada.");
  };
  const parsedDistance = Number(distance.replace(",", "."));
  const distanceValid = distance.trim() !== "" && isValidDistance(parsedDistance);
  const comparison = selected ? referenceComparison(selected) : null;

  return (
    <div className="flex flex-col gap-3">
      <section className="card card-pad" aria-labelledby={`trials-${kind}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 id={`trials-${kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Todas las pruebas</h3>
          <span className="count-pill">{trials.length} prueba{trials.length === 1 ? "" : "s"}</span>
        </div>
        <p className="m-0 mt-1 text-micro text-text-tertiary">Toca una fila para ver sus gráficos.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="data-table">
            <thead>
              {kind === "mru" ? (
                <tr>
                  <th scope="col" className="normal-case">Prueba</th><th scope="col" className="normal-case">v (m/s)</th><th scope="col" className="normal-case">Var. v</th>
                  <th scope="col" className="normal-case">a (m/s²)</th><th scope="col" className="normal-case">R² x(t)</th><th scope="col"><span className="sr-only">Estado</span></th>
                </tr>
              ) : (
                <tr>
                  <th scope="col" className="normal-case">Prueba</th><th scope="col" className="normal-case">θ (°)</th><th scope="col" className="normal-case">a (m/s²)</th>
                  <th scope="col" className="normal-case">g·sen θ</th><th scope="col" className="normal-case">μ</th><th scope="col"><span className="sr-only">Estado</span></th>
                </tr>
              )}
            </thead>
            <tbody>
              {ordered.map((trial) => {
                const isSelected = selected?.id === trial.id;
                const r = trial.analysis;
                return (
                  <tr key={trial.id} className={clsx(isSelected && "bg-accent-soft")}>
                    <th scope="row" className="text-left text-caption font-semibold normal-case tracking-normal text-text-primary">
                      <button type="button" className="font-semibold text-text-primary" aria-pressed={isSelected} onClick={() => { setSelectedId(trial.id); setDistance(""); }}>P{trial.attempt}</button>
                    </th>
                    {kind === "mru" ? (
                      <>
                        <td className="font-semibold">{formatNumber(r.mru?.vCruise, 2)}</td>
                        <td>{formatNumber(r.mru ? r.mru.vVariation * 100 : null, 1)} %</td>
                        <td>{formatNumber(r.mru?.aCruise, 2, true)}</td>
                        <td>{formatNumber(r.mru?.xFit.r2, 3)}</td>
                      </>
                    ) : (
                      <>
                        <td>{formatNumber(r.mrua?.thetaDeg, 1)}</td>
                        <td className="font-semibold">{formatNumber(r.mrua?.aMean, 2)}</td>
                        <td>{formatNumber(r.mrua?.aIdeal, 2)}</td>
                        <td>{formatNumber(r.mrua?.mu, 2)}</td>
                      </>
                    )}
                    <td>
                      {trial.quality === "ok"
                        ? <span className="inline-flex items-center gap-1 text-success"><CheckIcon size={14} />OK</span>
                        : <span className="inline-flex items-center gap-1 text-warning"><AlertIcon size={14} />Aviso</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {summary.primary && summary.n > 1 && (
          <p className="m-0 mt-3 text-caption text-text-secondary">
            Promedio de {summary.n} pruebas: <b className="text-text-primary">{formatNumber(summary.primary.mean, 2)} {kind === "mru" ? "m/s" : "m/s²"}</b>
            {summary.primary.std !== null && ` (σ ${formatNumber(summary.primary.std, 2)})`}.
          </p>
        )}
      </section>

      {selected && (
        <section className="flex flex-col gap-3" aria-labelledby={`selected-${kind}`}>
          <div className="card card-pad">
            <p className="eyebrow">Prueba seleccionada</p>
            <h3 id={`selected-${kind}`} className="m-0 mt-1 text-title font-semibold text-text-primary">Prueba {selected.attempt}</h3>
            <p className="m-0 mt-1 text-micro text-text-tertiary">{formatDateTime(selected.createdAt)} · {selected.id}</p>
            {comparison ? (
              <p className="m-0 mt-2 text-caption text-text-secondary">
                Distancia estimada {formatNumber(comparison.measured, 2)} m frente a {formatNumber(comparison.reference, 2)} m con cinta: diferencia {formatNumber(comparison.absolute, 2)} m
                {comparison.percent !== null ? ` (${formatNumber(comparison.percent, 1)} %)` : ""}.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-caption text-text-secondary" htmlFor={`ref-${kind}`}>Distancia medida con cinta (opcional):</label>
                <input
                  id={`ref-${kind}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={distance}
                  onChange={(event) => setDistance(event.target.value)}
                  className="h-10 w-24 rounded-[12px] border border-border-soft bg-surface px-3 text-body font-semibold tabular-nums outline-none focus:border-accent"
                />
                <span className="text-body font-semibold text-text-secondary">m</span>
                <Button variant="outline" size="sm" disabled={!distanceValid} onClick={() => { lab.setReference(selected.id, parsedDistance); setDistance(""); }}>Guardar</Button>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => void repeatTrial(selected)}><RestartIcon size={16} />Repetir</Button>
              <Button variant="danger" size="sm" onClick={() => void removeTrial(selected)}><TrashIcon size={16} />Eliminar</Button>
            </div>
          </div>
          <MotionAnalysisView analysis={selected.analysis} referenceM={selected.referenceM} />
        </section>
      )}

      <section className="dark-card p-4" aria-labelledby={`conclusion-${kind}`}>
        <p className="eyebrow">Conclusión con los datos registrados</p>
        <h3 id={`conclusion-${kind}`} className="sr-only">Conclusión</h3>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-body text-white/90">
          {conclusion.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <section className="card card-pad" aria-labelledby={`why-${kind}`}>
        <h3 id={`why-${kind}`} className="m-0 text-body-lg font-semibold text-text-primary">¿Por qué no coincide exactamente?</h3>
        <ul className="m-0 mt-2 flex list-disc flex-col gap-1.5 pl-5 text-caption text-text-secondary">
          {content.why.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </section>

      <section className="card card-pad" aria-labelledby={`questions-${kind}`}>
        <h3 id={`questions-${kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Preguntas para tu informe</h3>
        <ol className="m-0 mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-caption text-text-secondary">
          {content.questions.map((item) => <li key={item}>{item}</li>)}
        </ol>
      </section>

      <section className="card card-pad" aria-labelledby={`export-${kind}`}>
        <h3 id={`export-${kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Exportar para el informe</h3>
        <p className="m-0 mt-1 text-micro text-text-tertiary">Incluye las pruebas, las series a(t), v(t) y x(t), los umbrales y la versión del cálculo.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><DownloadIcon />CSV de resultados</Button>
          <Button variant="outline" size="sm" onClick={exportSamples}><DownloadIcon />CSV de series</Button>
          <Button variant="outline" size="sm" onClick={exportJson}><DownloadIcon />Exportar JSON</Button>
          <Button size="sm" onClick={() => void copySummary()}><CopyIcon />Copiar resumen para el informe</Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onMeasure}><RestartIcon size={16} />Medir otra</Button>
          <Button variant="danger" size="sm" onClick={() => void clearAll()}><TrashIcon size={16} />Borrar todo</Button>
        </div>
        <p className="m-0 mt-3 text-micro text-text-tertiary">
          Las pruebas se guardan solo en este navegador (almacenamiento local). No hay servidor ni envío de datos.
          {!lab.storageOk && <span className="mt-1 block font-semibold text-danger">El navegador no permitió guardarlas: exporta antes de cerrar la página.</span>}
        </p>
      </section>

      <Callout title="Estas cifras son estimaciones">
        Salen de integrar el acelerómetro del teléfono, no de un instrumento de laboratorio certificado. Úsalas para entender el movimiento y compara siempre con una referencia física.
      </Callout>
    </div>
  );
}
