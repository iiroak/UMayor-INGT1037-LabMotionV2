import type { Diagnostics } from "./diagnostics";
import type { MotionSample } from "./sensors";

function formatCsvNumber(value: number | null): string {
  return value === null ? "" : value.toFixed(5);
}

export function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Marca de tiempo segura para nombres de archivo: 2026-10-13_21-05-09. */
export function fileStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

/**
 * Formato de captura general (pestaña Capturar). Se conserva el mismo esquema
 * de columnas que LabMotion v1 para no romper análisis anteriores.
 */
export function downloadMeasurementCsv(samples: MotionSample[], captureLabel: string): void {
  const firstTime = samples[0]?.tMs ?? 0;
  const rows = samples.map((sample) => [
    (sample.tMs - firstTime).toFixed(2),
    formatCsvNumber(sample.acceleration.x),
    formatCsvNumber(sample.acceleration.y),
    formatCsvNumber(sample.acceleration.z),
    formatCsvNumber(sample.accelerationIncludingGravity.x),
    formatCsvNumber(sample.accelerationIncludingGravity.y),
    formatCsvNumber(sample.accelerationIncludingGravity.z),
    formatCsvNumber(sample.rotationRate.x),
    formatCsvNumber(sample.rotationRate.y),
    formatCsvNumber(sample.rotationRate.z),
    formatCsvNumber(sample.orientation.x),
    formatCsvNumber(sample.orientation.y),
    formatCsvNumber(sample.orientation.z),
    formatCsvNumber(sample.intervalMs),
  ].join(","));

  const csv = [
    `# LabMotion | Captura: ${captureLabel}`,
    "t_ms,ax_m_s2,ay_m_s2,az_m_s2,ax_gravity_m_s2,ay_gravity_m_s2,az_gravity_m_s2,alpha_deg_s,beta_deg_s,gamma_deg_s,orientation_alpha_deg,orientation_beta_deg,orientation_gamma_deg,interval_ms",
    ...rows,
  ].join("\n");
  downloadBlob(csv, `labmotion-medicion-${fileStamp()}.csv`, "text/csv;charset=utf-8");
}

export function downloadMeasurementJson(
  samples: MotionSample[],
  captureLabel: string,
  diagnostics: Diagnostics,
): void {
  const firstTime = samples[0]?.tMs ?? 0;
  const normalizedSamples = samples.map((sample) => ({
    ...sample,
    tMs: Number((sample.tMs - firstTime).toFixed(2)),
  }));
  const json = JSON.stringify(
    {
      project: "LabMotion",
      format: "labmotion-capture-v1",
      capture: captureLabel,
      capturedAt: new Date().toISOString(),
      diagnostics,
      samples: normalizedSamples,
    },
    null,
    2,
  );
  downloadBlob(json, `labmotion-medicion-${fileStamp()}.json`, "application/json;charset=utf-8");
}

export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Sigue con el método del textarea si el navegador no da permiso.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}
