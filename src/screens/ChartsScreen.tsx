import { useState } from "react";
import { KinematicsChart, StripChart, seriesLegend, type SensorChartMode } from "../components/StripChart";
import type { Measurement } from "../hooks/useRecording";
import type { Diagnostics } from "../lib/diagnostics";
import { downloadMeasurementCsv, downloadMeasurementJson } from "../lib/export";
import { formatNumber, formatSeconds } from "../lib/format";
import type { KinematicPoint } from "../lib/kinematics";
import type { MotionSample } from "../lib/sensors";
import { Button, DownloadIcon, SegmentedControl, TrashIcon, confirmAction } from "../ui";
import { Callout } from "../labs/tilt/TiltParts";

/** Pestaña Gráficos: señal en vivo o la última captura (función heredada de v1). */
export function ChartsScreen({
  liveSamples,
  measurement,
  kinematicPoints,
  diagnostics,
  onClear,
  onGoCapture,
}: {
  liveSamples: MotionSample[];
  measurement: Measurement | null;
  kinematicPoints: KinematicPoint[];
  diagnostics: Diagnostics;
  onClear: () => void;
  onGoCapture: () => void;
}) {
  const [mode, setMode] = useState<SensorChartMode>("acceleration");
  const samples = measurement?.samples ?? liveSamples;

  const clear = async () => {
    if (await confirmAction({ title: "¿Eliminar la captura?", message: "Se borran las muestras de esta sesión.", confirmLabel: "Eliminar", destructive: true })) onClear();
  };

  return (
    <section className="px-[18px] pt-4 pb-6">
      <p className="eyebrow">Análisis preliminar</p>
      <h1 className="screen-title">{measurement ? "Resultado de la captura" : "Explorar la señal"}</h1>
      <div className="mt-2"><span className="count-pill">{measurement ? `${measurement.summary.samples} muestras guardadas` : "Modo en vivo"}</span></div>

      <section className="card card-pad mt-4">
        <SegmentedControl<SensorChartMode>
          ariaLabel="Variable del gráfico"
          value={mode}
          onChange={setMode}
          options={[
            { value: "acceleration", label: "Aceleración" },
            { value: "gravity", label: "+ Gravedad" },
            { value: "rotation", label: "Giro" },
          ]}
        />
        <div className="chart-frame mt-3 h-[300px]"><StripChart samples={samples} mode={mode} /></div>
        <div className="mt-2 flex flex-wrap gap-3 text-micro font-semibold text-text-secondary">
          {seriesLegend(mode).map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5"><i className="inline-block size-2 rounded-full" style={{ background: item.color }} />{item.label}</span>
          ))}
        </div>
        {!measurement && (
          <p className="m-0 mt-3 text-caption text-text-secondary">
            La vista se actualiza con la señal en vivo. Para analizar una experiencia, ve a <button type="button" className="font-semibold text-accent-text underline underline-offset-2" onClick={onGoCapture}>Capturar</button>.
          </p>
        )}
      </section>

      {measurement && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              ["Duración", formatSeconds(measurement.summary.durationMs), "tiempo capturado"],
              ["Frecuencia", formatNumber(measurement.summary.frequencyHz, 1), "Hz"],
              ["Pico de aceleración", formatNumber(measurement.summary.peakAcceleration, 2), "m/s²"],
              ["Pico de giro", formatNumber(measurement.summary.peakRotation, 1), "°/s"],
            ].map(([label, value, unit]) => (
              <div key={label} className="card px-4 py-3">
                <p className="m-0 text-micro font-semibold text-text-secondary">{label}</p>
                <p className="m-0 font-mono text-title font-semibold tabular-nums">{value}</p>
                <p className="m-0 text-micro text-text-tertiary">{unit}</p>
              </div>
            ))}
          </div>

          {kinematicPoints.length > 1 && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <section className="card card-pad">
                <h3 className="m-0 text-body-medium font-semibold">Velocidad estimada</h3>
                <p className="m-0 text-micro text-text-tertiary">Integración trapezoidal del eje X</p>
                <div className="chart-frame mt-2 h-[200px]"><KinematicsChart points={kinematicPoints} metric="velocity" /></div>
              </section>
              <section className="card card-pad">
                <h3 className="m-0 text-body-medium font-semibold">Posición estimada</h3>
                <p className="m-0 text-micro text-text-tertiary">Segunda integración del eje X</p>
                <div className="chart-frame mt-2 h-[200px]"><KinematicsChart points={kinematicPoints} metric="position" /></div>
              </section>
            </div>
          )}

          <div className="mt-3">
            <Callout tone="warning" title="Interpretación responsable">
              La velocidad y la posición son estimaciones exploratorias: el ruido, el sesgo y la orientación del teléfono generan deriva al integrar la aceleración.
            </Callout>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Button size="sm" onClick={() => downloadMeasurementCsv(measurement.samples, "Captura de movimiento")}><DownloadIcon />Descargar CSV</Button>
            <Button size="sm" variant="outline" onClick={() => downloadMeasurementJson(measurement.samples, "Captura de movimiento", diagnostics)}><DownloadIcon />JSON + diagnóstico</Button>
            <Button size="sm" variant="danger" onClick={() => void clear()}><TrashIcon size={16} />Eliminar captura</Button>
          </div>
        </>
      )}
    </section>
  );
}
