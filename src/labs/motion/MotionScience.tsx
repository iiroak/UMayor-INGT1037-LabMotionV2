import physicsSource from "./motionPhysics.ts?raw";
import { extractRegion } from "../../lib/sourceRegions";
import { formatNumber } from "../../lib/format";
import { CodeIcon } from "../../ui";
import { Callout, Disclosure } from "../tilt/TiltParts";
import type { LabContent } from "./motionContent";
import { MOTION_CALC_VERSION } from "./motionPhysics";
import type { MotionLab } from "./useMotionLab";

function CodeBlock({ region }: { region: string }) {
  return (
    <Disclosure summary={<span className="inline-flex min-w-0 items-center gap-1.5"><CodeIcon size={16} /><span className="truncate">Código: <code className="font-mono text-[13px]">{region}</code></span></span>}>
      <pre className="code-block"><code>{extractRegion(physicsSource, region)}</code></pre>
    </Disclosure>
  );
}

/** Ciencia: la cadena de cálculo, con el código real que ejecuta la página. */
export function MotionScience({ lab, content }: { lab: MotionLab; content: LabContent }) {
  const { config, trials, simAnalysis, sim } = lab;
  const latest = sim.enabled ? simAnalysis : trials[trials.length - 1]?.analysis ?? null;
  const origin = sim.enabled ? "SIMULACIÓN — no son datos reales" : latest ? "Última prueba registrada" : "Aún no hay pruebas";
  const rows: [string, string][] = [
    ["Umbral de movimiento", `${formatNumber(config.triggerAccel, 2)} m/s² (mínimo; sube a ${config.noiseFactor}× el ruido)`],
    ["Reposo antes de empezar", `ventana de ${formatNumber(config.restWindowMs / 1000, 1)} s, σ máx. ${formatNumber(config.maxRestStd, 2)} m/s²`],
    ["Suavizado de a(t)", `promedio móvil de ${config.smoothMs} ms`],
    ["Hueco máximo entre muestras", `${config.maxGapMs} ms (si se supera, la prueba se invalida)`],
    ["Recorte del tramo ajustado", `${config.fitTrimMs} ms en cada extremo`],
    content.kind === "mru"
      ? ["Crucero mínimo", `${config.minCruiseMs} ms a más de ${Math.round(config.cruiseSpeedShare * 100)} % de la velocidad máxima`]
      : ["Meseta mínima", `${config.minWindowMs} ms de aceleración constante`],
    content.kind === "mru"
      ? ["Deriva aceptada", `aviso sobre ${Math.round(config.warnDriftShare * 100)} %, rechazo sobre ${Math.round(config.maxDriftShare * 100)} % de la velocidad máxima`]
      : ["Rampa válida", `de ${config.minRampDeg}° a ${config.maxRampDeg}°`],
  ];

  return (
    <div className="flex flex-col gap-3">
      <Callout title={origin}>
        El código que aparece en cada paso es el que ejecuta esta página (versión del cálculo <code>{MOTION_CALC_VERSION}</code>). Cumplir los umbrales indica que la lectura es coherente, no que sea precisa.
      </Callout>

      <ol className="m-0 list-none p-0">
        {content.science.map((step, index) => (
          <li key={step.title} className="relative pb-3">
            <article className="card card-pad">
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-micro font-bold text-accent-text">{index + 1}</span>
                <h3 className="m-0 text-body-lg font-semibold text-text-primary">{step.title}</h3>
              </div>
              <p className="m-0 mt-1.5 text-caption text-text-secondary"><b className="text-text-primary">En simple: </b>{step.simple}</p>
              <code className="formula mt-2">{step.formula}</code>
              <div className="mt-2 border-t border-divider pt-1"><CodeBlock region={step.region} /></div>
            </article>
          </li>
        ))}
      </ol>

      {latest && (
        <section className="card card-pad" aria-labelledby={`science-numbers-${content.kind}`}>
          <h3 id={`science-numbers-${content.kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Con los números de la prueba</h3>
          <dl className="m-0 mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-caption">
            <dt className="text-text-secondary">Ruido en reposo (σ plano)</dt><dd className="m-0 text-right tabular-nums">{formatNumber(latest.noise, 3)} m/s²</dd>
            <dt className="text-text-secondary">Umbral usado</dt><dd className="m-0 text-right tabular-nums">{formatNumber(latest.threshold, 2)} m/s²</dd>
            <dt className="text-text-secondary">Eje de movimiento (x, y)</dt><dd className="m-0 text-right tabular-nums">({formatNumber(latest.axis.x, 3)}, {formatNumber(latest.axis.y, 3)})</dd>
            <dt className="text-text-secondary">Linealidad</dt><dd className="m-0 text-right tabular-nums">{formatNumber(latest.linearity, 3)}</dd>
            {latest.mru && (
              <>
                <dt className="text-text-secondary">Deriva removida</dt><dd className="m-0 text-right tabular-nums">{formatNumber(latest.mru.driftRemoved, 3, true)} m/s</dd>
                <dt className="text-text-secondary">Pendiente de x(t)</dt><dd className="m-0 text-right tabular-nums">{formatNumber(latest.mru.xFit.slope, 3)} m/s</dd>
              </>
            )}
            {latest.mrua && (
              <>
                <dt className="text-text-secondary">θ = atan2(√(gx²+gy²), |gz|)</dt><dd className="m-0 text-right tabular-nums">{formatNumber(latest.mrua.thetaDeg, 2)}°</dd>
                <dt className="text-text-secondary">g·sen θ</dt><dd className="m-0 text-right tabular-nums">{formatNumber(latest.mrua.aIdeal, 3)} m/s²</dd>
                <dt className="text-text-secondary">Pendiente de v(t)</dt><dd className="m-0 text-right tabular-nums">{formatNumber(latest.mrua.vFit.slope, 3)} m/s²</dd>
                <dt className="text-text-secondary">2·c₂ de x(t)</dt><dd className="m-0 text-right tabular-nums">{formatNumber(2 * latest.mrua.xFit.c2, 3)} m/s²</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <section className="card card-pad" aria-labelledby={`science-params-${content.kind}`}>
        <h3 id={`science-params-${content.kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Parámetros de LabMotion</h3>
        <p className="m-0 mt-1 text-micro text-text-tertiary">No los entrega el sensor: son decisiones de LabMotion que se exportan con cada prueba.</p>
        <dl className="m-0 mt-2 grid grid-cols-1 gap-y-1.5 text-caption">
          {rows.map(([name, value]) => (
            <div key={name} className="flex items-baseline justify-between gap-3">
              <dt className="text-text-secondary">{name}</dt>
              <dd className="m-0 text-right tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card card-pad" aria-labelledby={`science-glossary-${content.kind}`}>
        <h3 id={`science-glossary-${content.kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Glosario</h3>
        <dl className="m-0 mt-2 flex flex-col gap-3">
          {content.glossary.map((item) => (
            <div key={item.term}>
              <dt className="text-caption font-semibold text-text-primary">{item.term} <span className="font-normal text-text-tertiary">· {item.symbol}{item.unit !== "—" ? ` (${item.unit})` : ""}</span></dt>
              <dd className="m-0 mt-0.5 text-caption text-text-secondary">{item.meaning}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
