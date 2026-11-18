import { useMemo } from "react";
import { TimeSeriesChart, type ChartBand, type ChartLine, type ChartPoint, type ChartSeries } from "../../components/TimeSeriesChart";
import { formatNumber, formatPercent } from "../../lib/format";
import { Callout } from "../tilt/TiltParts";
import type { MotionAnalysis } from "./motionPhysics";

const COLOR_A = "#3a83f7";
const COLOR_V = "#ee7c37";
const COLOR_X = "#3f9f46";
const COLOR_FIT = "#8b4ff7";
const COLOR_IDEAL = "#b2501c";

function Metric({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="soft-panel px-3 py-2.5">
      <p className="m-0 text-micro text-text-secondary">{label}</p>
      <p className="m-0 mt-0.5 text-title font-bold tabular-nums text-text-primary">
        {value}
        {unit && <span className="ml-1 text-caption font-medium text-text-tertiary">{unit}</span>}
      </p>
      {hint && <p className="m-0 text-micro text-text-tertiary">{hint}</p>}
    </div>
  );
}

function pointsOf(series: MotionAnalysis["series"], read: (point: MotionAnalysis["series"][number]) => number): ChartPoint[] {
  return series.map((point) => ({ x: point.t, y: read(point) }));
}

/**
 * Cifras y gráficos de una prueba (real o simulada): a(t), v(t) y x(t), con el
 * tramo analizado sombreado y la curva ajustada encima.
 */
export function MotionAnalysisView({ analysis, referenceM = null }: { analysis: MotionAnalysis; referenceM?: number | null }) {
  const { mru, mrua, series } = analysis;

  const charts = useMemo(() => {
    const a: ChartSeries[] = [{ label: "a(t)", color: COLOR_A, points: pointsOf(series, (p) => p.a), maxGap: 0.3 }];
    const v: ChartSeries[] = [{ label: "v(t)", color: COLOR_V, points: pointsOf(series, (p) => p.v), maxGap: 0.3 }];
    const x: ChartSeries[] = [{ label: "x(t)", color: COLOR_X, points: pointsOf(series, (p) => p.x), maxGap: 0.3 }];
    const aLines: ChartLine[] = [];
    const vLines: ChartLine[] = [];
    let bands: ChartBand[] = [];
    if (mru) {
      bands = [{ from: mru.cruiseFromS, to: mru.cruiseToS, label: "crucero" }];
      const inCruise = series.filter((p) => p.t >= mru.cruiseFromS && p.t <= mru.cruiseToS);
      x.push({ label: "ajuste lineal", color: COLOR_FIT, dashed: true, points: inCruise.map((p) => ({ x: p.t, y: mru.xFit.slope * p.t + mru.xFit.intercept })) });
      vLines.push({ y: mru.vCruise, label: "v de crucero", color: COLOR_FIT });
    }
    if (mrua) {
      bands = [{ from: mrua.windowFromS, to: mrua.windowToS, label: "tramo ajustado" }];
      aLines.push({ y: mrua.aMean, label: "medida", color: COLOR_FIT });
      aLines.push({ y: mrua.aIdeal, label: "g·sen θ", color: COLOR_IDEAL });
      const inWindow = series.filter((p) => p.t >= mrua.windowFromS && p.t <= mrua.windowToS);
      v.push({ label: "ajuste lineal", color: COLOR_FIT, dashed: true, points: inWindow.map((p) => ({ x: p.t, y: mrua.vFit.slope * p.t + mrua.vFit.intercept })) });
      x.push({ label: "ajuste cuadrático", color: COLOR_FIT, dashed: true, points: inWindow.map((p) => ({ x: p.t, y: mrua.xFit.c0 + mrua.xFit.c1 * p.t + mrua.xFit.c2 * p.t * p.t })) });
    }
    return { a, v, x, aLines, vLines, bands };
  }, [mru, mrua, series]);

  const distanceNote = referenceM !== null && (mru || mrua)
    ? (() => {
        const estimated = mru?.totalDistance ?? mrua?.totalDistance ?? 0;
        const diff = Math.abs(estimated - referenceM);
        return `Con cinta: ${formatNumber(referenceM, 2)} m · diferencia ${formatNumber(diff, 2)} m (${formatPercent((diff / referenceM) * 100)})`;
      })()
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      {mru && (
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Velocidad de crucero" value={formatNumber(mru.vCruise, 2)} unit="m/s" />
          <Metric label="Variación de la velocidad" value={formatPercent(mru.vVariation * 100)} hint="cerca de 0 % = uniforme" />
          <Metric label="Aceleración en el crucero" value={formatNumber(mru.aCruise, 2, true)} unit="m/s²" hint="cerca de 0 = uniforme" />
          <Metric label="R² de x(t)" value={formatNumber(mru.xFit.r2, 3)} hint="1 = recta perfecta" />
          <Metric label="Duración del crucero" value={formatNumber(mru.cruiseDurationS, 2)} unit="s" />
          <Metric label="Distancia total" value={formatNumber(mru.totalDistance, 2)} unit="m" hint={distanceNote} />
        </div>
      )}
      {mrua && (
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Aceleración medida" value={formatNumber(mrua.aMean, 2)} unit="m/s²" hint={`σ ${formatNumber(mrua.aStd, 2)} m/s²`} />
          <Metric label="g·sen θ (sin roce)" value={formatNumber(mrua.aIdeal, 2)} unit="m/s²" hint={`θ = ${formatNumber(mrua.thetaDeg, 1)}°`} />
          <Metric label="Diferencia" value={mrua.aDiffPercent === null ? "—" : formatPercent(mrua.aDiffPercent, 1)} hint="medida frente a g·sen θ" />
          <Metric label="Roce estimado μ" value={formatNumber(mrua.mu, 2)} hint="tan θ − a/(g·cos θ)" />
          <Metric label="R² de v(t)" value={formatNumber(mrua.vFit.r2, 3)} hint="1 = recta perfecta" />
          <Metric label="Distancia total" value={formatNumber(mrua.totalDistance, 2)} unit="m" hint={distanceNote} />
        </div>
      )}

      {analysis.warnings.length > 0 && (
        <Callout tone="warning" title="Avisos de calidad">
          <ul className="m-0 list-disc pl-4">
            {analysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </Callout>
      )}

      <section className="card card-pad" aria-labelledby="chart-a-title">
        <h4 id="chart-a-title" className="m-0 text-body font-semibold text-text-primary">Aceleración a(t)</h4>
        <p className="m-0 mt-0.5 mb-2 text-micro text-text-tertiary">
          {mru ? "Un pico al empujar, casi cero en el crucero y un pico negativo al frenar." : "Casi constante mientras el teléfono baja: esa es la meseta."}
        </p>
        <TimeSeriesChart series={charts.a} bands={charts.bands} lines={charts.aLines} yLabel="a (m/s²)" ariaLabel="Aceleración contra tiempo" />
      </section>
      <section className="card card-pad" aria-labelledby="chart-v-title">
        <h4 id="chart-v-title" className="m-0 text-body font-semibold text-text-primary">Velocidad v(t)</h4>
        <p className="m-0 mt-0.5 mb-2 text-micro text-text-tertiary">
          {mru ? "Sube con el empujón, se mantiene en el crucero y baja a cero al frenar." : "Debería crecer en línea recta: su pendiente es la aceleración."}
        </p>
        <TimeSeriesChart series={charts.v} bands={charts.bands} lines={charts.vLines} yLabel="v (m/s)" ariaLabel="Velocidad contra tiempo" />
      </section>
      <section className="card card-pad" aria-labelledby="chart-x-title">
        <h4 id="chart-x-title" className="m-0 text-body font-semibold text-text-primary">Posición x(t)</h4>
        <p className="m-0 mt-0.5 mb-2 text-micro text-text-tertiary">
          {mru ? "En el crucero debería ser una recta." : "Debería ser una parábola: x = ½·a·t²."}
        </p>
        <TimeSeriesChart series={charts.x} bands={charts.bands} yLabel="x (m)" ariaLabel="Posición contra tiempo" />
      </section>

      <section className="card card-pad" aria-labelledby="quality-title">
        <h4 id="quality-title" className="m-0 text-body font-semibold text-text-primary">Datos de la prueba</h4>
        <dl className="m-0 mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
          <dt className="text-text-secondary">Frecuencia de muestreo</dt><dd className="m-0 text-right tabular-nums">{formatNumber(analysis.rateHz, 0)} Hz</dd>
          <dt className="text-text-secondary">Duración grabada</dt><dd className="m-0 text-right tabular-nums">{formatNumber(analysis.durationS, 2)} s</dd>
          <dt className="text-text-secondary">Ruido en reposo</dt><dd className="m-0 text-right tabular-nums">{formatNumber(analysis.noise, 3)} m/s²</dd>
          <dt className="text-text-secondary">Umbral de movimiento</dt><dd className="m-0 text-right tabular-nums">{formatNumber(analysis.threshold, 2)} m/s²</dd>
          <dt className="text-text-secondary">Linealidad del movimiento</dt><dd className="m-0 text-right tabular-nums">{formatNumber(analysis.linearity, 3)}</dd>
          <dt className="text-text-secondary">Fuente de la aceleración</dt><dd className="m-0 text-right">{analysis.source === "con-gravedad" ? "Con gravedad" : "Lineal (filtrada)"}</dd>
          {mru && (
            <>
              <dt className="text-text-secondary">Deriva corregida</dt><dd className="m-0 text-right tabular-nums">{formatNumber(mru.driftRemoved, 3, true)} m/s</dd>
              <dt className="text-text-secondary">Velocidad máxima</dt><dd className="m-0 text-right tabular-nums">{formatNumber(mru.vPeak, 2)} m/s</dd>
            </>
          )}
          {mrua && (
            <>
              <dt className="text-text-secondary">|g| medido en reposo</dt><dd className="m-0 text-right tabular-nums">{formatNumber(mrua.gravity, 2)} m/s²</dd>
              <dt className="text-text-secondary">a desde x(t) (2·c₂)</dt><dd className="m-0 text-right tabular-nums">{formatNumber(2 * mrua.xFit.c2, 2)} m/s²</dd>
              <dt className="text-text-secondary">Alineación con la pendiente</dt><dd className="m-0 text-right tabular-nums">{mrua.alignment === null ? "—" : formatNumber(mrua.alignment, 3)}</dd>
            </>
          )}
        </dl>
      </section>
    </div>
  );
}
