import clsx from "clsx";
import type { Diagnostics } from "../lib/diagnostics";
import { formatNumber } from "../lib/format";
import { Button, CheckIcon, CopyIcon, XIcon } from "../ui";

/** Pestaña Diagnóstico: ¿puede este equipo participar? (heredada de v1). */
export function DiagnosticsScreen({
  diagnostics,
  statusLabel,
  sensorsActive,
  onEnable,
  onCopy,
}: {
  diagnostics: Diagnostics;
  statusLabel: string;
  sensorsActive: boolean;
  onEnable: () => void;
  onCopy: () => void;
}) {
  const supported = diagnostics.checks.filter((check) => check.supported).length;
  const ua = diagnostics.userAgent;
  const context = ua.includes("Android") ? "Android / navegador móvil" : /iPhone|iPad/.test(ua) ? "iPhone o iPad / navegador móvil" : "Escritorio u otro navegador";
  return (
    <section className="px-[18px] pt-4 pb-6">
      <p className="eyebrow">Prueba de compatibilidad</p>
      <h1 className="screen-title">¿Puede este equipo participar?</h1>

      <section className="card card-pad mt-4">
        <div className="flex items-center gap-4 border-b border-divider pb-4">
          <div className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
            <strong className="font-mono text-[36px] font-semibold text-accent-text">{supported}</strong>
            <span className="text-caption text-text-secondary">de {diagnostics.checks.length}</span>
          </div>
          <div className="min-w-0">
            <h3 className="m-0 text-body-medium font-semibold">Lectura del navegador</h3>
            <p className="m-0 text-micro text-text-tertiary">Para el laboratorio bastan HTTPS y DeviceMotionEvent con datos.</p>
          </div>
        </div>
        <ul className="m-0 list-none p-0">
          {diagnostics.checks.map((check) => (
            <li key={check.label} className="flex items-center gap-3 border-b border-divider py-3 last:border-b-0">
              <span className={clsx("grid size-7 shrink-0 place-items-center rounded-[8px]", check.supported ? "bg-success-soft text-success" : "bg-surface-muted text-text-tertiary")}>
                {check.supported ? <CheckIcon size={16} /> : <XIcon size={14} />}
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate text-caption font-semibold text-text-primary">{check.label}</p>
                <p className="m-0 text-micro text-text-secondary">{check.supported ? "Sí" : "No"} · {check.detail}</p>
              </div>
            </li>
          ))}
        </ul>
        {!sensorsActive && <Button size="sm" className="mt-3 w-full" onClick={onEnable}>Activar sensores para medir la frecuencia</Button>}
      </section>

      <section className="card card-pad mt-3">
        <h3 className="m-0 text-body-medium font-semibold">Datos del entorno</h3>
        <p className="m-0 text-micro text-text-tertiary">Útiles para documentar la prueba en el informe.</p>
        <dl className="m-0 mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 text-caption">
          <dt className="text-text-secondary">Estado de sensores</dt><dd className="m-0 text-right font-mono">{statusLabel}</dd>
          <dt className="text-text-secondary">Frecuencia efectiva</dt><dd className="m-0 text-right font-mono">{diagnostics.effectiveFrequencyHz ? `${formatNumber(diagnostics.effectiveFrequencyHz, 1)} Hz` : "Sin muestras"}</dd>
          <dt className="text-text-secondary">Intervalo informado</dt><dd className="m-0 text-right font-mono">{diagnostics.reportedIntervalMs ? `${formatNumber(diagnostics.reportedIntervalMs, 1)} ms` : "Sin muestras"}</dd>
          <dt className="text-text-secondary">Orientación de pantalla</dt><dd className="m-0 text-right font-mono">{diagnostics.screenOrientation}</dd>
          <dt className="text-text-secondary">Contexto</dt><dd className="m-0 text-right font-mono">{context}</dd>
        </dl>
        <details className="disclosure mt-2">
          <summary>Ver user agent completo</summary>
          <code className="block break-all font-mono text-micro text-text-tertiary">{ua}</code>
        </details>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={onCopy}><CopyIcon />Copiar diagnóstico</Button>
      </section>
    </section>
  );
}
