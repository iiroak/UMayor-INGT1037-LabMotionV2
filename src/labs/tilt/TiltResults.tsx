import clsx from "clsx";
import { useMemo, useState } from "react";
import type { Diagnostics } from "../../lib/diagnostics";
import { copyText, downloadBlob, fileStamp } from "../../lib/export";
import { formatDateTime, formatDeg, formatNumber, formatPercent, formatSeconds } from "../../lib/format";
import { AlertIcon, Button, CheckIcon, CopyIcon, DownloadIcon, EmptyStateCard, ProtractorIcon, RestartIcon, TrashIcon, confirmAction, showToast } from "../../ui";
import { AngleChart } from "./TiltChart";
import { TiltComparisonChart } from "./TiltComparisonChart";
import { Callout } from "./TiltParts";
import { samplesCsv, sessionJson, trialsCsv } from "./tiltExport";
import { buildConclusion, reportSummary, summarizeByReference, type TiltTrial } from "./tiltSession";
import type { TiltLab } from "./useTiltLab";

function refLabel(value: number): string {
  return formatDeg(value, value % 1 === 0 ? 0 : 1);
}

export function TiltResults({
  lab,
  diagnostics,
  deviceLabel,
  onRepeat,
  onMeasure,
}: {
  lab: TiltLab;
  diagnostics: Diagnostics;
  deviceLabel: string;
  onRepeat: (trial: TiltTrial) => void;
  onMeasure: () => void;
}) {
  const { trials } = lab;
  const summaries = useMemo(() => summarizeByReference(trials), [trials]);
  const ordered = useMemo(() => [...trials].sort((a, b) => a.referenceDeg - b.referenceDeg || a.attempt - b.attempt), [trials]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = ordered.find((trial) => trial.id === selectedId) ?? ordered[ordered.length - 1] ?? null;
  const conclusion = useMemo(() => buildConclusion(trials), [trials]);
  const maxExtra = Math.max(3, ...summaries.map((summary) => Math.max(...summary.trials.map((trial) => trial.attempt))));
  const attemptColumns = Array.from({ length: Math.min(maxExtra, 5) }, (_, index) => index + 1);

  if (trials.length === 0) {
    return (
      <EmptyStateCard
        icon={<ProtractorIcon size={30} className="text-text-tertiary" />}
        title="Aún no hay mediciones"
        description="Registra al menos una prueba estable con su ángulo de referencia para ver la tabla, el gráfico y la conclusión."
        action={<Button onClick={onMeasure}>Registrar medición</Button>}
      />
    );
  }

  const exportCsv = () => {
    downloadBlob(trialsCsv(trials), `labmotion-inclinacion-resultados-${fileStamp()}.csv`, "text/csv;charset=utf-8");
  };
  const exportSamples = () => {
    downloadBlob(samplesCsv(trials), `labmotion-inclinacion-muestras-${fileStamp()}.csv`, "text/csv;charset=utf-8");
  };
  const exportJson = () => {
    downloadBlob(sessionJson(trials, { diagnostics }), `labmotion-inclinacion-${fileStamp()}.json`, "application/json;charset=utf-8");
  };
  const copySummary = async () => {
    const copied = await copyText(reportSummary(trials, { device: deviceLabel }));
    showToast(copied ? "Resumen copiado. Pégalo en el informe." : "No se pudo copiar el resumen.");
  };
  const removeTrial = async (trial: TiltTrial) => {
    const ok = await confirmAction({
      title: `¿Eliminar la Prueba ${trial.attempt} de ${refLabel(trial.referenceDeg)}?`,
      message: `Medida ${formatDeg(trial.meanDeg)}. Se borran también sus muestras de este navegador.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    lab.deleteTrial(trial.id);
    setSelectedId(null);
    showToast("Prueba eliminada.");
  };
  const repeatTrial = async (trial: TiltTrial) => {
    const ok = await confirmAction({
      title: `¿Repetir la Prueba ${trial.attempt} de ${refLabel(trial.referenceDeg)}?`,
      message: "La prueba actual solo se reemplaza si la nueva medición termina correctamente.",
      confirmLabel: "Repetir",
    });
    if (ok) onRepeat(trial);
  };
  const clearAll = async () => {
    const ok = await confirmAction({
      title: "¿Borrar todas las pruebas?",
      message: `Se eliminarán ${trials.length} pruebas y sus muestras de este navegador. Exporta antes si las necesitas.`,
      confirmLabel: "Borrar todo",
      destructive: true,
    });
    if (!ok) return;
    lab.clearTrials();
    showToast("Sesión borrada.");
  };

  return (
    <div className="flex flex-col gap-3">
      <section className="card card-pad" aria-labelledby="summary-table-title">
        <div className="flex items-center justify-between gap-2">
          <h3 id="summary-table-title" className="m-0 text-body-lg font-semibold text-text-primary">Registro por referencia</h3>
          <span className="count-pill">{trials.length} prueba{trials.length === 1 ? "" : "s"}</span>
        </div>
        <p className="m-0 mt-1 text-micro text-text-tertiary">Promedio de cada prueba en grados. «Prom.» usa solo las pruebas existentes; n indica cuántas hay.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Ref.</th>
                {attemptColumns.map((attempt) => <th key={attempt} scope="col">P{attempt}</th>)}
                <th scope="col">Prom.</th>
                <th scope="col">Error</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((summary) => {
                const byAttempt = new Map(summary.trials.map((trial) => [trial.attempt, trial]));
                return (
                  <tr key={summary.referenceDeg}>
                    <th scope="row" className="text-left text-caption font-semibold normal-case tracking-normal text-text-primary">{refLabel(summary.referenceDeg)}</th>
                    {attemptColumns.map((attempt) => {
                      const trial = byAttempt.get(attempt);
                      return <td key={attempt} className={trial ? "" : "text-text-disabled"}>{trial ? formatNumber(trial.meanDeg, 1) : "—"}</td>;
                    })}
                    <td className="font-semibold">{formatNumber(summary.meanDeg, 1)}<span className="ml-1 text-micro font-normal text-text-tertiary">n={summary.n}</span></td>
                    <td>
                      {formatNumber(summary.absErrorDeg, 1)}°
                      <span className="block text-micro text-text-tertiary">{summary.percentError === null ? "% no aplica" : formatPercent(summary.percentError)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad" aria-labelledby="comparison-title">
        <h3 id="comparison-title" className="m-0 text-body-lg font-semibold text-text-primary">Referencia física vs. LabMotion</h3>
        <p className="m-0 mt-1 mb-2 text-micro text-text-tertiary">Si un punto cae sobre la diagonal, la medida coincide con el transportador. La distancia vertical es el error.</p>
        <TiltComparisonChart summaries={summaries} />
      </section>

      <section className="card card-pad" aria-labelledby="trials-title">
        <h3 id="trials-title" className="m-0 text-body-lg font-semibold text-text-primary">Todas las pruebas</h3>
        <p className="m-0 mt-1 text-micro text-text-tertiary">Toca una fila para ver su gráfico y sus datos.</p>
        <div className="mt-2 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col" title="Referencia del transportador físico">Ref.</th>
                <th scope="col" title="Número de intento">Prueba</th>
                <th scope="col">Medida</th>
                <th scope="col" title="Diferencia absoluta">Dif.</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((trial) => {
                const isSelected = selected?.id === trial.id;
                return (
                  <tr key={trial.id} className={clsx("cursor-pointer", isSelected && "bg-accent-soft")} onClick={() => setSelectedId(trial.id)}>
                    <td>
                      <button type="button" className="font-semibold text-text-primary" aria-pressed={isSelected} onClick={() => setSelectedId(trial.id)}>
                        {refLabel(trial.referenceDeg)}
                      </button>
                    </td>
                    <td>P{trial.attempt}</td>
                    <td className="font-semibold">{formatDeg(trial.meanDeg)}</td>
                    <td>{formatDeg(trial.absErrorDeg)}</td>
                    <td>
                      {trial.quality === "ok" ? (
                        <span className="inline-flex items-center gap-1 text-success"><CheckIcon size={14} />OK</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning"><AlertIcon size={14} />Aviso</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <section className="card card-pad" aria-labelledby="selected-title">
          <p className="eyebrow">Prueba seleccionada</p>
          <div className="flex items-baseline justify-between gap-2">
            <h3 id="selected-title" className="m-0 mt-1 text-title font-semibold text-text-primary">{refLabel(selected.referenceDeg)} · Prueba {selected.attempt}</h3>
            <span className="text-title font-bold tabular-nums">{formatDeg(selected.meanDeg)}</span>
          </div>
          <p className="m-0 mt-1 mb-3 text-micro text-text-tertiary">{formatDateTime(selected.createdAt)} · {selected.id}</p>
          <AngleChart
            points={selected.angles}
            timeMode="relative-start"
            referenceDeg={selected.referenceDeg}
            meanDeg={selected.meanDeg}
            ariaLabel={`Inclinación contra tiempo de la prueba ${selected.attempt} con referencia ${refLabel(selected.referenceDeg)}`}
          />
          <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
            <dt className="text-text-secondary">Referencia (transportador)</dt><dd className="m-0 text-right tabular-nums">{formatDeg(selected.referenceDeg, 1)}</dd>
            <dt className="text-text-secondary">Promedio medido</dt><dd className="m-0 text-right font-semibold tabular-nums">{formatDeg(selected.meanDeg, 2)}</dd>
            <dt className="text-text-secondary">Error absoluto</dt><dd className="m-0 text-right tabular-nums">{formatDeg(selected.absErrorDeg, 2)}</dd>
            <dt className="text-text-secondary">Error porcentual</dt><dd className="m-0 text-right tabular-nums">{selected.percentError === null ? "No aplica (ref. 0°)" : formatPercent(selected.percentError, 2)}</dd>
            <dt className="text-text-secondary">Desviación σ</dt><dd className="m-0 text-right tabular-nums">{formatDeg(selected.stdDeg, 3)}</dd>
            <dt className="text-text-secondary">Rango (mín.–máx.)</dt><dd className="m-0 text-right tabular-nums">{formatNumber(selected.minDeg, 2)}–{formatNumber(selected.maxDeg, 2)}°</dd>
            <dt className="text-text-secondary">Muestras válidas</dt><dd className="m-0 text-right tabular-nums">{selected.validSamples} de {selected.totalSamples}</dd>
            <dt className="text-text-secondary">Duración</dt><dd className="m-0 text-right tabular-nums">{formatSeconds(selected.durationMs, 2)}</dd>
            <dt className="text-text-secondary">Frecuencia efectiva</dt><dd className="m-0 text-right tabular-nums">{formatNumber(selected.frequencyHz, 1)} Hz</dd>
            <dt className="text-text-secondary">|g| media</dt><dd className="m-0 text-right tabular-nums">{formatNumber(selected.meanGravity, 2)} m/s²</dd>
            <dt className="text-text-secondary">Modo de gravedad</dt><dd className="m-0 text-right">{selected.mode === "diferencia" ? "a_total − a_lineal" : selected.mode === "reposo" ? "En reposo" : "Mixto"}</dd>
            <dt className="text-text-secondary">Espera hasta estable</dt><dd className="m-0 text-right tabular-nums">{formatSeconds(selected.waitMs)}</dd>
          </dl>
          {selected.warnings.length > 0 && (
            <div className="mt-3">
              <Callout tone="warning" title="Advertencias de esta prueba">
                <ul className="m-0 list-disc pl-4">{selected.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </Callout>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => void repeatTrial(selected)}><RestartIcon size={16} />Repetir</Button>
            <Button variant="danger" size="sm" onClick={() => void removeTrial(selected)}><TrashIcon size={16} />Eliminar</Button>
          </div>
        </section>
      )}

      <section className="dark-card p-4" aria-labelledby="conclusion-title">
        <p className="eyebrow">Conclusión con los datos registrados</p>
        <h3 id="conclusion-title" className="sr-only">Conclusión</h3>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-body text-white/90">
          {conclusion.map((line) => <li key={line}>{line}</li>)}
        </ul>
      </section>

      <section className="card card-pad" aria-labelledby="why-title">
        <h3 id="why-title" className="m-0 text-body-lg font-semibold text-text-primary">¿Por qué no coincide exactamente?</h3>
        <ul className="m-0 mt-2 flex list-disc flex-col gap-1.5 pl-5 text-caption text-text-secondary">
          <li><b className="text-text-primary">Ruido del sensor:</b> el acelerómetro nunca entrega dos lecturas idénticas; por eso se promedia una ventana estable.</li>
          <li><b className="text-text-primary">Movimiento:</b> tocar o golpear el soporte agrega aceleración que contamina la estimación de la gravedad.</li>
          <li><b className="text-text-primary">Soporte y transportador:</b> el soporte puede ceder o el transportador leerse con 1–2° de diferencia.</li>
          <li><b className="text-text-primary">Ejes desalineados:</b> el sensor no está perfectamente paralelo a la carcasa, y una funda o la cámara pueden levantar un borde.</li>
          <li><b className="text-text-primary">Sistema operativo:</b> el navegador filtra y estima la aceleración lineal; cada equipo lo hace distinto.</li>
          <li><b className="text-text-primary">Superficie «horizontal»:</b> si la mesa no está nivelada, todas las medidas se desplazan igual.</li>
        </ul>
      </section>

      <section className="card card-pad" aria-labelledby="export-title">
        <h3 id="export-title" className="m-0 text-body-lg font-semibold text-text-primary">Exportar para el informe</h3>
        <p className="m-0 mt-1 text-micro text-text-tertiary">Incluye referencias, pruebas, muestras originales, configuración, diagnóstico y versión del cálculo.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><DownloadIcon />CSV de resultados</Button>
          <Button variant="outline" size="sm" onClick={exportSamples}><DownloadIcon />CSV de muestras</Button>
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
    </div>
  );
}
