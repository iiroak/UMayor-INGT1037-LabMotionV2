import clsx from "clsx";
import type { ReactNode } from "react";
import { V1_URL } from "../config";
import type { SensorController } from "../hooks/useSensors";
import { guidedProgress as motionProgress, type MotionTrial } from "../labs/motion/motionSession";
import { LABS, type LabId } from "../labs/registry";
import { guidedProgress as tiltProgress, type TiltTrial } from "../labs/tilt/tiltSession";
import { ArrowDownIcon, ChevronRightIcon, FlaskIcon, PlayIcon, ProtractorIcon } from "../ui";

const LAB_ICONS: Record<LabId, ReactNode> = {
  tilt: <ProtractorIcon size={22} />,
  mru: <PlayIcon size={22} />,
  mrua: <ArrowDownIcon size={22} />,
};

export type LabTrials = { tilt: TiltTrial[]; mru: MotionTrial[]; mrua: MotionTrial[] };

function progressText(id: LabId, trials: LabTrials): string {
  const list = trials[id];
  if (list.length === 0) return "Sin mediciones todavía";
  const { done, target } = id === "tilt" ? tiltProgress(trials.tilt) : motionProgress(list as MotionTrial[]);
  return `${done}/${target} pruebas guiadas${list.length > done ? ` · ${list.length} en total` : ""}`;
}

/** Pestaña Labs: portada con el estado del instrumento y los laboratorios. */
export function LabsScreen({
  sensors,
  statusLabel,
  trials,
  onOpenLab,
  onEnable,
}: {
  sensors: SensorController;
  statusLabel: string;
  trials: LabTrials;
  onOpenLab: (id: LabId) => void;
  onEnable: () => void;
}) {
  const active = sensors.state === "active" && sensors.signal === "receiving";

  return (
    <section className="px-[18px] pt-4 pb-6">
      <p className="eyebrow">Universidad Mayor · INGT1037 · Grupo 1</p>
      <h1 className="screen-title">Haz visible lo que el teléfono puede medir.</h1>
      <p className="m-0 mt-2 text-body text-text-secondary">
        LabMotion convierte un smartphone en un instrumento de laboratorio: lee sus sensores, muestra cómo se calcula cada número y permite compararlo con una referencia física.
      </p>

      <section className={clsx("mt-5 p-4", active ? "card" : "dark-card")} aria-labelledby="instrument-title">
        <div className="flex items-center gap-3">
          <span className={clsx("status-dot", active && "is-active")} aria-hidden="true" />
          <div className="min-w-0">
            <p className="eyebrow">Estado del instrumento</p>
            <h2 id="instrument-title" className={clsx("m-0 text-body-lg font-semibold", active ? "text-text-primary" : "text-white")}>{statusLabel}</h2>
          </div>
        </div>
        <p className={clsx("m-0 mt-2 text-caption", active ? "text-text-secondary" : "text-white/70")}>
          {active ? "El teléfono está enviando mediciones al navegador." : "Activa el acceso para observar datos reales. El permiso se pide solo al tocar el botón."}
        </p>
        {sensors.error && <p className="m-0 mt-2 text-caption font-semibold text-danger">{sensors.error}</p>}
        <div className={clsx("mt-2 flex flex-wrap gap-x-3 gap-y-1 text-micro font-semibold", active ? "text-text-tertiary" : "text-white/60")}>
          <span>{sensors.capabilities.secureContext ? "HTTPS activo" : "Se requiere HTTPS"}</span>
          <span>{sensors.capabilities.deviceMotion ? "DeviceMotion detectado" : "DeviceMotion no detectado"}</span>
        </div>
        {sensors.state !== "active" && (
          <button
            type="button"
            onClick={onEnable}
            disabled={sensors.state === "requesting"}
            className="mt-4 flex h-12 w-full items-center justify-between rounded-full bg-white px-5 text-body-medium font-semibold text-fab active:opacity-80 disabled:opacity-50"
          >
            {sensors.state === "requesting" ? "Solicitando…" : "Activar sensores"}
            <ChevronRightIcon />
          </button>
        )}
      </section>

      <div className="section-heading"><div><p className="eyebrow">Experimentos</p><h2>Laboratorios</h2></div><span className="count-pill">{LABS.length}</span></div>
      <div className="flex flex-col gap-2.5">
        {LABS.map((lab) => (
          <article key={lab.id} className="list-card">
            <div className="list-card-mark" aria-hidden="true">{LAB_ICONS[lab.id]}</div>
            <div className="list-card-copy">
              <h3>
                {lab.title}
                {lab.status === "piloto" && <span className="ml-2 inline-flex min-h-5 items-center rounded-full bg-warning-soft px-2 align-middle text-[11px] font-bold text-warning">Piloto</span>}
              </h3>
              <p>{lab.summary}</p>
              <p className="mt-1 font-semibold text-text-primary">{progressText(lab.id, trials)}</p>
            </div>
            <button type="button" className="list-card-action" onClick={() => onOpenLab(lab.id)}>
              Abrir
              <ChevronRightIcon size={16} strokeWidth={2.4} />
            </button>
          </article>
        ))}
      </div>
      <p className="m-0 mt-2 px-1 text-micro text-text-tertiary">
        «Piloto»: el laboratorio funciona, pero todavía se está validando con teléfonos reales; trata sus cifras como estimaciones.
      </p>
      <nav className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1" aria-label="Guías de laboratorio">
        <span className="text-caption text-text-secondary">Guías para estudiantes y docentes:</span>
        {LABS.map((lab) => (
          <a key={lab.id} className="inline-flex min-h-11 items-center gap-1 text-caption font-semibold text-accent-text no-underline active:opacity-70" href={lab.guideUrl} target="_blank" rel="noreferrer">
            {lab.guideLabel}
            <ChevronRightIcon size={14} />
          </a>
        ))}
      </nav>
      <article className="list-card is-disabled mt-2.5">
        <div className="list-card-mark" aria-hidden="true"><FlaskIcon size={22} /></div>
        <div className="list-card-copy">
          <h3>Próximos módulos</h3>
          <p>Giro acumulado y péndulo. Pendientes: no están implementados en esta versión.</p>
        </div>
      </article>

      <p className="m-0 mt-6 px-1 text-micro text-text-tertiary">
        Las pestañas Magnitudes, Capturar, Gráficos y Diagnóstico mantienen el monitor de sensores de <a className="font-semibold text-accent-text" href={V1_URL} target="_blank" rel="noreferrer">LabMotion v1</a>. No hay backend, cuentas ni envío de datos.
      </p>
    </section>
  );
}
