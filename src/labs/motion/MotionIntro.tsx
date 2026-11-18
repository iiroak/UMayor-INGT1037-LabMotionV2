import { PUBLIC_URL } from "../../config";
import type { SensorController } from "../../hooks/useSensors";
import { Button, CheckIcon, ChevronRightIcon, FlaskIcon, ShieldCheckIcon } from "../../ui";
import { Callout } from "../tilt/TiltParts";
import { SensorStatusBadge, type LabSensorStatus } from "../tilt/TiltIntro";
import type { LabContent } from "./motionContent";

/** Introducción del laboratorio: pregunta, materiales, procedimiento y estado de los sensores. */
export function MotionIntro({
  content,
  sensors,
  status,
  onStart,
  onSimulate,
  onDiagnostics,
}: {
  content: LabContent;
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
        <span className="grid size-12 place-items-center rounded-full bg-white/10" aria-hidden="true"><FlaskIcon size={26} /></span>
        <p className="m-0 mt-4 text-body-lg font-semibold text-white">Pregunta del experimento</p>
        <p className="m-0 mt-1 text-body text-white/80">{content.question}</p>
        <p className="m-0 mt-3 text-caption text-white/60"><b className="text-white/80">Hipótesis:</b> {content.hypothesis}</p>
      </section>

      <section className="card card-pad" aria-labelledby={`materials-${content.kind}`}>
        <h3 id={`materials-${content.kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Materiales</h3>
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-body text-text-secondary">
          {content.materials.map((item) => (
            <li key={item} className="flex items-start gap-2"><CheckIcon size={18} className="mt-0.5 shrink-0 text-success" />{item}</li>
          ))}
        </ul>
        <p className="m-0 mt-3 text-caption text-text-tertiary">{content.position}</p>
      </section>

      <section className="card card-pad" aria-labelledby={`procedure-${content.kind}`}>
        <h3 id={`procedure-${content.kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Procedimiento</h3>
        <ol className="m-0 mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-body text-text-secondary">
          {content.procedure.map((step) => <li key={step}>{step}</li>)}
        </ol>
      </section>

      <section className="card card-pad" aria-labelledby={`status-${content.kind}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 id={`status-${content.kind}`} className="m-0 text-body-lg font-semibold text-text-primary">Estado de los sensores</h3>
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
