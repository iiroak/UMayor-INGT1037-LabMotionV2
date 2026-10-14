import clsx from "clsx";
import { PUBLIC_URL } from "../../config";
import type { SensorController } from "../../hooks/useSensors";
import { Button, CheckIcon, ChevronRightIcon, ProtractorIcon, ShieldCheckIcon } from "../../ui";
import { Callout } from "./TiltParts";

export type LabSensorStatus = { label: string; tone: "ok" | "wait" | "bad" };

/** Estado de sensores con los rótulos del laboratorio. */
export function labSensorStatus(sensors: SensorController, hasValidReading: boolean): LabSensorStatus {
  if (!sensors.capabilities.secureContext) return { label: "Se requiere HTTPS", tone: "bad" };
  switch (sensors.state) {
    case "idle":
      return { label: "Solicitar permiso", tone: "wait" };
    case "requesting":
      return { label: "Solicitando permiso…", tone: "wait" };
    case "denied":
      return { label: "Permiso rechazado", tone: "bad" };
    case "unsupported":
      return { label: "No compatible", tone: "bad" };
    case "error":
      return { label: "Se requiere HTTPS", tone: "bad" };
    case "active":
      if (sensors.signal === "waiting") return { label: "Esperando datos…", tone: "wait" };
      if (sensors.signal === "lost") return sensors.latest ? { label: "Se perdió la señal", tone: "bad" } : { label: "Sin datos", tone: "bad" };
      return hasValidReading ? { label: "Listo", tone: "ok" } : { label: "Sin datos suficientes", tone: "bad" };
    default:
      return { label: "Solicitar permiso", tone: "wait" };
  }
}

export function SensorStatusBadge({ status }: { status: LabSensorStatus }) {
  return (
    <span className={clsx("state-pill", status.tone === "ok" ? "is-stable" : status.tone === "wait" ? "is-neutral" : "is-insufficient")}>
      <span className={clsx("status-dot", status.tone === "ok" && "is-active")} aria-hidden="true" />
      {status.label}
    </span>
  );
}

export function TiltIntro({
  sensors,
  status,
  onStart,
  onSimulate,
  onDiagnostics,
}: {
  sensors: SensorController;
  status: LabSensorStatus;
  onStart: () => void;
  onSimulate: () => void;
  onDiagnostics: () => void;
}) {
  const problem = !sensors.capabilities.secureContext
    ? `Los sensores del navegador solo funcionan en una dirección HTTPS. Abre ${PUBLIC_URL} en el teléfono.`
    : sensors.state === "denied"
      ? "El permiso de movimiento fue rechazado. En iPhone: Ajustes › Safari › Movimiento y orientación; en Android, revisa los permisos del sitio y recarga."
      : sensors.state === "unsupported"
        ? "Este navegador no entrega DeviceMotionEvent. Prueba con Chrome (Android) o Safari (iPhone)."
        : sensors.state === "active" && sensors.signal === "lost"
          ? sensors.latest
            ? "Dejaron de llegar muestras. Mantén la página visible y sin ahorro de energía."
            : "El navegador no entrega datos de movimiento. Suele pasar en computadores sin acelerómetro: usa un teléfono o el modo simulación."
          : sensors.error || null;

  return (
    <div className="flex flex-col gap-3">
      <section className="dark-card p-5">
        <span className="grid size-12 place-items-center rounded-full bg-white/10" aria-hidden="true"><ProtractorIcon size={26} /></span>
        <p className="m-0 mt-4 text-body-lg font-semibold text-white">Pregunta del experimento</p>
        <p className="m-0 mt-1 text-body text-white/80">¿Podemos medir una inclinación con el celular y comprobarla con un transportador?</p>
        <p className="m-0 mt-3 text-caption text-white/60"><b className="text-white/80">Hipótesis:</b> el ángulo que calcula LabMotion será cercano al ángulo fijado con un transportador físico.</p>
      </section>

      <section className="card card-pad" aria-labelledby="materials-title">
        <h3 id="materials-title" className="m-0 text-body-lg font-semibold text-text-primary">Materiales</h3>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-body text-text-secondary">
          {["Teléfono compatible (Android con Chrome o iPhone con Safari)", "Transportador físico", "Soporte inclinable y estable (un libro, una tabla o un atril)"].map((item) => (
            <li key={item} className="flex items-start gap-2"><CheckIcon size={18} className="mt-0.5 shrink-0 text-success" />{item}</li>
          ))}
        </ul>
        <p className="m-0 mt-3 text-caption text-text-tertiary">Posición inicial: teléfono con la <b>pantalla hacia arriba</b>, sobre una superficie horizontal.</p>
      </section>

      <section className="card card-pad" aria-labelledby="status-title">
        <div className="flex items-center justify-between gap-2">
          <h3 id="status-title" className="m-0 text-body-lg font-semibold text-text-primary">Estado de los sensores</h3>
          <SensorStatusBadge status={status} />
        </div>
        {problem && <div className="mt-3"><Callout tone="danger">{problem}</Callout></div>}
        <div className="mt-4 flex flex-col gap-2">
          <Button fullWidth onClick={onStart} disabled={sensors.state === "requesting"}>
            {sensors.state === "requesting" ? "Solicitando permiso…" : "Comenzar experimento"}
            <ChevronRightIcon />
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={onDiagnostics}><ShieldCheckIcon size={18} />Diagnóstico</Button>
            <Button variant="outline" size="sm" onClick={onSimulate}>Ensayar sin sensores</Button>
          </div>
        </div>
        <p className="m-0 mt-3 text-micro text-text-tertiary">El permiso se pide al tocar «Comenzar», nunca al cargar la página. Los datos no salen del teléfono.</p>
      </section>
    </div>
  );
}
