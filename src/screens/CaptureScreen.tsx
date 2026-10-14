import clsx from "clsx";
import { formatSeconds } from "../lib/format";
import type { Recording } from "../hooks/useRecording";
import { Button, RecordIcon, StopIcon } from "../ui";

/** Pestaña Capturar: serie libre de muestras (función heredada de v1). */
export function CaptureScreen({ recording, onStart, onStop }: { recording: Recording; onStart: () => void; onStop: () => void }) {
  const { isRecording, elapsedMs } = recording;
  return (
    <section className="px-[18px] pt-4 pb-6">
      <p className="eyebrow">Captura local</p>
      <h1 className="screen-title">Guardar una serie de muestras</h1>
      <p className="m-0 mt-1.5 text-body text-text-secondary">Registra lo que entrega el sensor sin elegir un experimento. Todo queda en este teléfono.</p>

      <section className={clsx("mt-5 p-4", isRecording ? "dark-card" : "card")} aria-live="polite">
        <p className="eyebrow">{isRecording ? "Capturando" : "Listo para capturar"}</p>
        <p className={clsx("m-0 mt-1 font-mono text-[44px] leading-tight font-semibold tabular-nums", isRecording ? "text-white" : "text-text-primary")}>
          {isRecording ? formatSeconds(elapsedMs) : "0,0 s"}
        </p>
        <p className={clsx("m-0 mt-1 text-caption", isRecording ? "text-white/70" : "text-text-secondary")}>
          {isRecording ? "Mueve el teléfono ahora. Mantén la página visible para no perder el permiso del sensor." : `Aceleración, giro, orientación y tiempo de cada muestra (máx. ${recording.maxSamples}).`}
        </p>
        <div className="mt-4">
          {isRecording ? (
            <button type="button" onClick={onStop} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white text-body-medium font-semibold text-fab active:opacity-80">
              <StopIcon />Detener medición
            </button>
          ) : (
            <Button fullWidth onClick={onStart}><RecordIcon size={20} />Iniciar medición</Button>
          )}
        </div>
      </section>

      <div className="section-heading"><div><p className="eyebrow">Procedimiento sugerido</p><h2>Cómo capturar</h2></div></div>
      <ol className="card card-pad m-0 flex list-none flex-col gap-3 text-caption text-text-secondary">
        {["Fija el teléfono sobre una superficie o carrito.", "Activa sensores y espera la lectura inicial.", "Realiza el movimiento durante 3 a 5 segundos.", "Detén, observa el gráfico y exporta los datos."].map((step, index) => (
          <li key={step} className="flex gap-3"><b className="w-6 shrink-0 font-mono text-accent-text">0{index + 1}</b>{step}</li>
        ))}
      </ol>
      <p className="m-0 mt-3 px-1 text-micro text-text-tertiary">Para medir inclinación con referencia física usa el laboratorio en la pestaña Labs.</p>
    </section>
  );
}
