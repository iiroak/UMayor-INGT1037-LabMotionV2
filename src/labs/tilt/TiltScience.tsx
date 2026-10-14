import { useState, type ReactNode } from "react";
import fisicaSource from "../../lib/fisica.ts?raw";
import { formatDeg, formatNumber } from "../../lib/format";
import { extractRegion } from "../../lib/sourceRegions";
import { BottomSheet, CodeIcon } from "../../ui";
import tiltSource from "./tiltPhysics.ts?raw";
import { AngleChart } from "./TiltChart";
import { Callout, Disclosure, KindTag, StatePill, type DataKind } from "./TiltParts";
import { NEEDLE_TAU_MS } from "./TiltProtractor";
import { TILT_GLOSSARY, type GlossaryKey } from "./tiltGlossary";
import { GRAVEDAD_REFERENCIA, TILT_CALC_VERSION, gravityModeLabel, type TiltReading } from "./tiltPhysics";
import type { TiltLab } from "./useTiltLab";

const f2 = (value: number | null | undefined) => formatNumber(value, 2);
/** Valor con paréntesis si es negativo, para que la sustitución se lea bien. */
const p2 = (value: number) => (value < 0 ? `(${f2(value)})` : f2(value));

function Tile({ label, value, unit, color, onClick }: { label: string; value: string; unit: string; color?: string; onClick?: () => void }) {
  const content = (
    <>
      <span style={color ? { color } : undefined}>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </>
  );
  return onClick ? (
    <button type="button" className="value-tile text-left active:opacity-75" onClick={onClick} aria-label={`${label}: ${value} ${unit}. Ver significado`}>
      {content}
    </button>
  ) : (
    <div className="value-tile">{content}</div>
  );
}

function Step({
  index,
  title,
  kind,
  simple,
  children,
  last = false,
}: {
  index: number;
  title: string;
  kind: DataKind;
  simple: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3">
      <div className="flex flex-col items-center">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fab text-micro font-bold text-fab-content">{index}</span>
        {!last && <span className="mt-1 w-0.5 flex-1 rounded-full bg-border-soft" aria-hidden="true" />}
      </div>
      <article className="card card-pad mb-3 min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-body-lg font-semibold text-text-primary">{title}</h3>
          <KindTag kind={kind} />
        </div>
        <p className="m-0 mt-1.5 text-caption text-text-secondary"><b className="text-text-primary">En simple: </b>{simple}</p>
        <div className="mt-2 border-t border-divider pt-1">
          <Disclosure summary="Ver datos y fórmula">{children}</Disclosure>
        </div>
      </article>
    </li>
  );
}

function CodeBlock({ source, region }: { source: string; region: string }) {
  return (
    <Disclosure summary={<span className="inline-flex min-w-0 items-center gap-1.5"><CodeIcon size={16} /><span className="truncate">Código: <code className="font-mono text-[13px]">{region}</code></span></span>}>
      <pre className="code-block"><code>{extractRegion(source, region)}</code></pre>
    </Disclosure>
  );
}

export function TiltScience({ lab, frequencyHz }: { lab: TiltLab; frequencyHz: number | null }) {
  const [glossary, setGlossary] = useState<GlossaryKey | null>(null);
  const { view, config } = lab;
  const reading: TiltReading | null = view.result?.ok ? view.result.reading : null;
  const failure = view.result && !view.result.ok ? view.result : null;
  const simulated = view.source === "sim";
  const sourceLabel = simulated ? "SIMULACIÓN — no son datos reales" : view.source === "frozen" ? "Lectura congelada" : "Último instante en vivo";
  const open = (key: GlossaryKey) => () => setGlossary(key);
  const entry = glossary ? TILT_GLOSSARY[glossary] : null;

  const g = reading?.gravity;
  const horizontal = g ? Math.hypot(g.x, g.y) : null;

  return (
    <div className="flex flex-col gap-3">
      <Callout title={sourceLabel}>
        Todos los números de esta vista vienen de la misma lectura que mueve la aguja en Demostración{simulated ? " (aquí, un vector sintético)" : ""}. Toca un valor para saber qué significa.
      </Callout>

      {failure && !simulated && (
        <Callout tone="danger" title="No hay lectura confiable">{failure.detail}</Callout>
      )}

      <ol className="m-0 list-none p-0">
        <Step index={1} title="Sensor del celular" kind="directa" simple="El acelerómetro percibe la dirección de la gravedad. Al inclinar el teléfono, cambia cómo se reparte esa señal entre sus ejes X, Y y Z.">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="f efectiva" value={formatNumber(simulated ? null : frequencyHz, 1)} unit="Hz" onClick={open("frequency")} />
            <Tile label="muestras válidas" value={simulated ? "—" : `${view.validSamples}/${view.totalSamples}`} unit="desde que se activó" />
          </div>
          <p className="m-0 mt-2 text-micro text-text-tertiary">Origen: <code>DeviceMotionEvent</code> del navegador. Ejes del teléfono: X hacia la derecha de la pantalla, Y hacia arriba de la pantalla, Z saliendo de la pantalla.</p>
        </Step>

        <Step index={2} title="Aceleración incluyendo gravedad y aceleración lineal" kind="directa" simple="El teléfono entrega dos lecturas: una con la gravedad incluida y otra que estima solo el movimiento.">
          <p className="eyebrow mt-1 mb-1.5">a_total (con gravedad)</p>
          <div className="grid grid-cols-3 gap-2">
            <Tile label="ax_total" value={f2(reading?.aTotal.x)} unit="m/s²" color="var(--axis-x)" onClick={open("aTotal")} />
            <Tile label="ay_total" value={f2(reading?.aTotal.y)} unit="m/s²" color="var(--axis-y)" onClick={open("aTotal")} />
            <Tile label="az_total" value={f2(reading?.aTotal.z)} unit="m/s²" color="var(--axis-z)" onClick={open("aTotal")} />
          </div>
          <p className="eyebrow mt-3 mb-1.5">a (lineal, sin gravedad)</p>
          {reading?.aLinear || !reading ? (
            <div className="grid grid-cols-3 gap-2">
              <Tile label="ax" value={f2(reading?.aLinear?.x)} unit="m/s²" color="var(--axis-x)" onClick={open("aLinear")} />
              <Tile label="ay" value={f2(reading?.aLinear?.y)} unit="m/s²" color="var(--axis-y)" onClick={open("aLinear")} />
              <Tile label="az" value={f2(reading?.aLinear?.z)} unit="m/s²" color="var(--axis-z)" onClick={open("aLinear")} />
            </div>
          ) : (
            <Callout tone="warning" title="El navegador no entrega aceleración lineal">Se usa a_total como gravedad («estimación en reposo»): solo es válido con el teléfono quieto.</Callout>
          )}
        </Step>

        <Step index={3} title="Vector de gravedad estimado" kind="derivada" simple="Si a la lectura total le quitamos la parte del movimiento, queda la gravedad vista desde los ejes del teléfono.">
          <code className="formula">{reading?.mode === "reposo" ? "g ≈ a_total   (estimación en reposo)" : "g = a_total − a_lineal   (eje por eje)"}</code>
          {reading && g && (
            <code className="formula mt-2">
              {reading.aLinear
                ? [
                  `gx = ${p2(reading.aTotal.x)} − ${p2(reading.aLinear.x)} = ${f2(g.x)} m/s²`,
                  `gy = ${p2(reading.aTotal.y)} − ${p2(reading.aLinear.y)} = ${f2(g.y)} m/s²`,
                  `gz = ${p2(reading.aTotal.z)} − ${p2(reading.aLinear.z)} = ${f2(g.z)} m/s²`,
                ].join("\n")
                : [`gx ≈ ${f2(g.x)} m/s²`, `gy ≈ ${f2(g.y)} m/s²`, `gz ≈ ${f2(g.z)} m/s²`].join("\n")}
            </code>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Tile label="gx" value={f2(g?.x)} unit="m/s²" color="var(--axis-x)" onClick={open("gravity")} />
            <Tile label="gy" value={f2(g?.y)} unit="m/s²" color="var(--axis-y)" onClick={open("gravity")} />
            <Tile label="gz" value={f2(g?.z)} unit="m/s²" color="var(--axis-z)" onClick={open("gravity")} />
          </div>
          {reading && <p className="m-0 mt-2 text-micro text-text-tertiary">Modo: {gravityModeLabel(reading.mode)}.</p>}
          <CodeBlock source={fisicaSource} region="gravedadEstimada" />
        </Step>

        <Step index={4} title="Magnitud |g|" kind="derivada" simple="El tamaño del vector de gravedad. Quieto, debería acercarse a la gravedad terrestre.">
          <code className="formula">|g| = √(gx² + gy² + gz²)</code>
          {g && reading && (
            <code className="formula mt-2">{`|g| = √(${p2(g.x)}² + ${p2(g.y)}² + ${p2(g.z)}²) = ${f2(reading.gravityMagnitude)} m/s²`}</code>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Tile label="|g| estimada" value={f2(reading?.gravityMagnitude ?? failure?.gravityMagnitude)} unit="m/s²" onClick={open("gravityMagnitude")} />
            <Tile label="referencia explicativa" value={formatNumber(GRAVEDAD_REFERENCIA, 2)} unit="m/s² (aprox.)" />
          </div>
          <p className="m-0 mt-2 text-micro text-text-tertiary">
            9,81 m/s² se muestra solo para explicar. Que |g| se parezca no valida el sensor: g sale de dos lecturas del mismo sistema. Fuera de {formatNumber(config.minGravity, 1)}–{formatNumber(config.maxGravity, 1)} m/s² LabMotion no entrega ángulo.
          </p>
          <CodeBlock source={fisicaSource} region="magnitudDeVector" />
        </Step>

        <Step index={5} title="Ángulo calculado θ" kind="derivada" simple="Comparamos la parte de la gravedad que queda «acostada» en la pantalla (X e Y) con la que la atraviesa (Z). Plano: todo en Z, 0°. Vertical: nada en Z, 90°.">
          <code className="formula">θ = atan2(√(gx² + gy²), |gz|) × 180/π</code>
          {g && reading && horizontal !== null && (
            <code className="formula mt-2">
              {[
                `√(gx² + gy²) = √(${p2(g.x)}² + ${p2(g.y)}²) = ${f2(horizontal)}`,
                `|gz| = ${f2(Math.abs(g.z))}`,
                `θ = atan2(${f2(horizontal)}, ${f2(Math.abs(g.z))}) = ${formatDeg(reading.thetaDeg, 2)}`,
              ].join("\n")}
            </code>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Tile label="θ" value={formatNumber(reading?.thetaDeg, 2)} unit="grados" color="var(--axis-theta)" onClick={open("theta")} />
            <Tile label="en Demostración" value={formatNumber(reading?.thetaDeg, 1)} unit="grados (1 decimal)" />
          </div>
          <p className="m-0 mt-2 text-micro text-text-tertiary">
            El valor no tiene dirección: inclinar hacia bordes distintos puede dar el mismo ángulo. Los decimales extra son del cálculo, no precisión física.
          </p>
          <CodeBlock source={tiltSource} region="inclinacionDeSuperficie" />
          <CodeBlock source={tiltSource} region="lecturaDeInclinacion" />
        </Step>

        <Step index={6} title="Transportador digital" kind="derivada" simple="La aguja de Demostración apunta a θ. Es una representación del número, no un instrumento de comparación." last>
          <p className="m-0 text-caption text-text-secondary">
            La aguja usa un suavizado <b>solo visual</b> (constante de tiempo {formatNumber(NEEDLE_TAU_MS / 1000, 2)} s) para no saltar en cada cuadro. La cifra grande, esta vista y las mediciones usan cada muestra sin filtrar. Con «reducir movimiento» del sistema, la aguja no se anima.
          </p>
        </Step>
      </ol>

      <section className="card card-pad" aria-labelledby="stability-title">
        <div className="flex items-center justify-between gap-2">
          <h3 id="stability-title" className="m-0 text-body-lg font-semibold text-text-primary">¿Está quieto? Estabilidad</h3>
          <StatePill state={view.stability.state} simulated={simulated} />
        </div>
        <p className="m-0 mt-1.5 text-caption text-text-secondary">
          LabMotion revisa el último {formatNumber(config.windowMs / 1000, 1)} s. Si el ángulo varía poco y no hay aceleración lineal ni giro apreciables, la lectura se considera estable. El giroscopio solo detecta movimiento.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="σ ventana" value={formatNumber(view.stability.stdDeg, 2)} unit={`° (máx. ${config.maxStdDeg})`} onClick={open("std")} />
          <Tile label="rango" value={formatNumber(view.stability.rangeDeg, 2)} unit={`° (máx. ${config.maxRangeDeg})`} onClick={open("window")} />
          <Tile label="|a| media" value={formatNumber(view.stability.meanLinear, 2)} unit={`m/s² (máx. ${config.maxLinearAccel})`} onClick={open("aLinear")} />
          <Tile label="|ω| máx." value={formatNumber(view.stability.maxRotation, 1)} unit={`°/s (máx. ${config.maxRotationRate})`} onClick={open("rotation")} />
        </div>
        <p className="m-0 mt-2 text-micro text-text-tertiary">{simulated ? "En simulación no hay ruido real." : `${view.stability.reason} (${view.stability.n} lecturas en la ventana)`}</p>
        <CodeBlock source={tiltSource} region="evaluarEstabilidad" />
      </section>

      <section className="card card-pad" aria-labelledby="history-title">
        <div className="flex items-center justify-between gap-2">
          <h3 id="history-title" className="m-0 text-body-lg font-semibold text-text-primary">Inclinación vs. tiempo</h3>
          <span className="count-pill">{simulated ? "Simulación" : view.source === "frozen" ? "Congelada" : "En vivo"}</span>
        </div>
        <p className="m-0 mt-1 mb-3 text-micro text-text-tertiary">Últimos {formatNumber(config.historyMs / 1000, 0)} s de lecturas válidas. Eje horizontal: segundos hasta el instante mostrado.</p>
        {simulated ? (
          <p className="m-0 rounded-[16px] bg-surface-soft p-4 text-center text-caption text-text-secondary">El gráfico solo muestra datos reales del sensor.</p>
        ) : (
          <AngleChart points={view.history} timeMode="relative-end" ariaLabel="Gráfico de inclinación en grados contra tiempo en segundos" />
        )}
      </section>

      <section className="card card-pad">
        <h3 className="m-0 text-body-lg font-semibold text-text-primary">Promedio y error de cada prueba</h3>
        <code className="formula mt-2">{["θ̄ = Σθᵢ / N        (lecturas de la ventana estable)", "E_abs = |θ̄ − θ_ref|", "E_% = |θ̄ − θ_ref| / |θ_ref| × 100   (no aplica si θ_ref = 0°)"].join("\n")}</code>
        <p className="m-0 mt-2 text-micro text-text-tertiary">θ_ref es el ángulo del transportador físico. Cálculo versión <code>{TILT_CALC_VERSION}</code>.</p>
        <CodeBlock source={tiltSource} region="estadisticas" />
        <CodeBlock source={tiltSource} region="errores" />
      </section>

      <BottomSheet open={entry !== null} onClose={() => setGlossary(null)} title={entry?.title}>
        {entry && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <KindTag kind={entry.kind} />
              <span className="text-micro text-text-tertiary">Unidad: {entry.unit}</span>
            </div>
            <code className="formula">{entry.symbol}</code>
            <p className="m-0 text-body text-text-primary">{entry.meaning}</p>
            <p className="m-0 text-caption text-text-secondary"><b>¿De dónde sale? </b>{entry.origin}</p>
            <button type="button" className="h-12 w-full rounded-full bg-fab text-body-medium font-semibold text-fab-content active:opacity-80" onClick={() => setGlossary(null)}>Entendido</button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
