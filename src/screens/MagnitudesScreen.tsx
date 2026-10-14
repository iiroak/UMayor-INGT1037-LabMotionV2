import fisicaSource from "../lib/fisica.ts?raw";
import tiltSource from "../labs/tilt/tiltPhysics.ts?raw";
import { inclinacionDeSuperficie } from "../labs/tilt/tiltPhysics";
import {
  anguloGirado,
  CALCULATION_CATALOG,
  errorRelativo,
  frecuenciaDeMuestreo,
  gravedadEstimada,
  inclinacionRespectoVertical,
  magnitudDeVector,
  type CalculationDefinition,
  type Vector3,
} from "../lib/fisica";
import { formatNumber } from "../lib/format";
import type { KinematicPoint } from "../lib/kinematics";
import type { Axis, MotionSample } from "../lib/sensors";
import { extractRegion } from "../lib/sourceRegions";
import { CodeIcon } from "../ui";
import { Disclosure, KindTag } from "../labs/tilt/TiltParts";

function completeVector(axis: Axis): Vector3 | null {
  if (axis.x === null || axis.y === null || axis.z === null) return null;
  return { x: axis.x, y: axis.y, z: axis.z };
}

function axisValues(axis: Axis | null, labels: [string, string, string] = ["X", "Y", "Z"]): { label: string; value: number | null }[] {
  return [
    { label: labels[0], value: axis?.x ?? null },
    { label: labels[1], value: axis?.y ?? null },
    { label: labels[2], value: axis?.z ?? null },
  ];
}

function MeasurementCard({ item, values }: { item: CalculationDefinition; values: { label: string; value: number | null }[] }) {
  const isVector = values.length > 1;
  return (
    <article className="card card-pad flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <KindTag kind="directa" />
          <h3 className="m-0 mt-1.5 text-body-lg font-semibold text-text-primary">{item.title}</h3>
        </div>
        <span className="shrink-0 rounded-[8px] bg-surface-soft px-2 py-1 font-mono text-micro text-text-tertiary">{item.symbol}</span>
      </div>
      {isVector ? (
        <div className="grid grid-cols-3 gap-2">
          {values.map((entry) => (
            <div className="value-tile" key={entry.label}>
              <span>{entry.label}</span>
              <strong>{formatNumber(entry.value, 2, true)}</strong>
              <small>{item.unit}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 font-mono text-[26px] font-semibold tabular-nums text-text-primary">
          {formatNumber(values[0]?.value ?? null, 2)} <span className="text-caption text-text-tertiary">{item.unit}</span>
        </p>
      )}
      <p className="m-0 text-caption text-text-secondary">{item.description}</p>
      <p className="m-0 text-micro text-text-tertiary">Origen: <code>{item.source}</code></p>
    </article>
  );
}

function DerivedCard({ item, value, reference }: { item: CalculationDefinition; value: number | null; reference?: { value: number; label: string } }) {
  const error = reference && value !== null ? errorRelativo(value, reference.value) : null;
  const source = item.sourceFile === "tilt" ? tiltSource : fisicaSource;
  return (
    <article className="card card-pad flex flex-col gap-2.5 border-t-2 border-[var(--axis-theta)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <KindTag kind="derivada" />
          <h3 className="m-0 mt-1.5 text-body-lg font-semibold text-text-primary">{item.title}</h3>
        </div>
        <span className="shrink-0 rounded-[8px] bg-surface-soft px-2 py-1 font-mono text-micro text-text-tertiary">{item.symbol}</span>
      </div>
      <p className="m-0 font-mono text-[26px] font-semibold tabular-nums text-text-primary">
        {formatNumber(value, 2, item.id !== "lab-tilt" && item.id !== "tilt" && item.id !== "frequency")} <span className="text-caption text-text-tertiary">{item.unit}</span>
      </p>
      <p className="m-0 text-caption text-text-secondary">{item.description}</p>
      <code className="formula">{item.formula}</code>
      {reference && (
        <p className="m-0 text-micro text-text-secondary">
          {reference.label}: <b className="tabular-nums">{formatNumber(reference.value, 2)} {item.unit}</b>
          {error !== null && <span className="ml-2 text-text-tertiary">diferencia {formatNumber(error, 2)} % (solo explicativo: ambas lecturas son del mismo sensor)</span>}
        </p>
      )}
      <p className="m-0 text-micro text-text-tertiary">Origen: {item.source}</p>
      {item.region && (
        <Disclosure summary={<span className="inline-flex items-center gap-1.5"><CodeIcon size={16} />Ver el código que lo calcula</span>}>
          <pre className="code-block"><code>{extractRegion(source, item.region)}</code></pre>
        </Disclosure>
      )}
    </article>
  );
}

/** Pestaña Magnitudes: qué entrega el navegador y qué calcula LabMotion. */
export function MagnitudesScreen({
  latest,
  samples,
  frequencyHz,
  kinematicPoints,
}: {
  latest: MotionSample | null;
  samples: MotionSample[];
  frequencyHz: number | null;
  kinematicPoints: KinematicPoint[];
}) {
  const accelerationVector = latest ? completeVector(latest.acceleration) : null;
  const totalAcceleration = latest ? completeVector(latest.accelerationIncludingGravity) : null;
  const gravity = accelerationVector && totalAcceleration ? gravedadEstimada(totalAcceleration, accelerationVector) : null;
  const kinematics = kinematicPoints.length > 0 ? kinematicPoints[kinematicPoints.length - 1] : null;
  const angle = samples.length > 1 ? anguloGirado(samples.map((sample) => ({ tMs: sample.tMs, velocidad: sample.rotationRate.x }))) : null;
  const direct = CALCULATION_CATALOG.filter((item) => item.kind === "directa");
  const derived = CALCULATION_CATALOG.filter((item) => item.kind === "derivada");

  const directValues: Record<string, { label: string; value: number | null }[]> = {
    "linear-acceleration": axisValues(latest?.acceleration ?? null),
    "gravity-acceleration": axisValues(latest?.accelerationIncludingGravity ?? null),
    "angular-velocity": axisValues(latest?.rotationRate ?? null, ["α", "β", "γ"]),
    orientation: axisValues(latest?.orientation ?? null, ["α", "β", "γ"]),
    "sample-interval": [{ label: "Δt", value: latest?.intervalMs ?? null }],
  };
  const derivedValues: Record<string, number | null> = {
    magnitude: accelerationVector ? magnitudDeVector(accelerationVector) : null,
    "estimated-gravity": gravity ? magnitudDeVector(gravity) : null,
    "lab-tilt": gravity ? inclinacionDeSuperficie(gravity) : null,
    tilt: gravity ? inclinacionRespectoVertical(gravity) : null,
    frequency: frequencyHz ?? frecuenciaDeMuestreo(samples.map((sample) => sample.tMs)),
    velocity: kinematics?.velocity ?? null,
    position: kinematics?.position ?? null,
    "rotated-angle": angle,
  };

  return (
    <section className="px-[18px] pt-4 pb-6">
      <p className="eyebrow">Instrumentación abierta</p>
      <h1 className="screen-title">Qué puede medir un smartphone</h1>
      <div className="mt-4 rounded-[20px] bg-accent-soft p-4">
        <p className="m-0 text-body text-text-primary">
          LabMotion recibe señales del sistema operativo, conserva el tiempo de cada muestra y muestra cómo una medición directa se convierte en una magnitud calculada. El código de cada tarjeta es el mismo que ejecuta esta página.
        </p>
        <p className="m-0 mt-3 font-mono text-micro font-semibold text-accent-text">Sensor → Muestra → Fórmula → Magnitud</p>
      </div>

      <div className="section-heading">
        <div><p className="eyebrow">Señales del dispositivo</p><h2>Mediciones directas</h2></div>
        <span className="count-pill">{samples.length > 0 ? `${samples.length} muestras` : "Sin muestras"}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {direct.map((item) => <MeasurementCard key={item.id} item={item} values={directValues[item.id] ?? [{ label: "", value: null }]} />)}
      </div>

      <div className="section-heading">
        <div><p className="eyebrow">Física transparente</p><h2>Magnitudes derivadas</h2></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {derived.map((item) => (
          <DerivedCard
            key={item.id}
            item={item}
            value={derivedValues[item.id] ?? null}
            reference={item.id === "estimated-gravity" ? { value: 9.81, label: "Gravedad terrestre aproximada" } : undefined}
          />
        ))}
      </div>
    </section>
  );
}
