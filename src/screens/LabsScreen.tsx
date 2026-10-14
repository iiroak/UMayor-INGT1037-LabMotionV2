import clsx from "clsx";
import { GUIDE_URL, V1_URL } from "../config";
import type { SensorController } from "../hooks/useSensors";
import { guidedProgress, type TiltTrial } from "../labs/tilt/tiltSession";
import { ChevronRightIcon, FlaskIcon, ProtractorIcon } from "../ui";

/** Pestaña Labs: portada con el estado del instrumento y los laboratorios. */
export function LabsScreen({
  sensors,
  statusLabel,
  trials,
  onOpenTilt,
  onEnable,
}: {
  sensors: SensorController;
  statusLabel: string;
  trials: TiltTrial[];
  onOpenTilt: () => void;
  onEnable: () => void;
}) {
  const active = sensors.state === "active" && sensors.signal === "receiving";
  const { done, target } = guidedProgress(trials);

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

      <div className="section-heading"><div><p className="eyebrow">Experimentos</p><h2>Laboratorios</h2></div><span className="count-pill">1</span></div>
      <article className="list-card">
        <div className="list-card-mark" aria-hidden="true"><ProtractorIcon size={22} /></div>
        <div className="list-card-copy">
          <h3>Medición de inclinación</h3>
          <p>Acelerómetro + transportador físico · 0°, 30°, 45° y 60°</p>
          <p className="mt-1 font-semibold text-text-primary">{trials.length === 0 ? "Sin mediciones todavía" : `${done}/${target} pruebas guiadas${trials.length > done ? ` · ${trials.length} en total` : ""}`}</p>
        </div>
        <button type="button" className="list-card-action" onClick={onOpenTilt}>
          Abrir
          <ChevronRightIcon size={16} strokeWidth={2.4} />
        </button>
      </article>

      <a className="mt-2 flex min-h-11 items-center justify-between rounded-[16px] px-4 text-caption font-semibold text-accent-text no-underline active:opacity-70" href={GUIDE_URL} target="_blank" rel="noreferrer">
        Guía de laboratorio para estudiantes y docentes
        <ChevronRightIcon size={16} />
      </a>

      <article className="list-card is-disabled mt-2.5">
        <div className="list-card-mark" aria-hidden="true"><FlaskIcon size={22} /></div>
        <div className="list-card-copy">
          <h3>Próximos módulos</h3>
          <p>Giro acumulado, MRU/MRUA y péndulo. Pendientes: no están implementados en esta versión.</p>
        </div>
      </article>

      <p className="m-0 mt-6 px-1 text-micro text-text-tertiary">
        Las pestañas Magnitudes, Capturar, Gráficos y Diagnóstico mantienen el monitor de sensores de <a className="font-semibold text-accent-text" href={V1_URL} target="_blank" rel="noreferrer">LabMotion v1</a>. No hay backend, cuentas ni envío de datos.
      </p>
    </section>
  );
}
