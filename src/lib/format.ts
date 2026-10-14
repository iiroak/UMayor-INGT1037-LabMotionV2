/**
 * Formato numérico en español de Chile (coma decimal), usado en toda la UI.
 * Las exportaciones CSV/JSON usan punto decimal para que las hojas de cálculo
 * y los scripts las lean sin ambigüedad.
 */
const formatters = new Map<string, Intl.NumberFormat>();

function formatter(digits: number, signed: boolean): Intl.NumberFormat {
  const key = `${digits}:${signed}`;
  let current = formatters.get(key);
  if (!current) {
    current = new Intl.NumberFormat("es-CL", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: signed ? "exceptZero" : "auto",
    });
    formatters.set(key, current);
  }
  return current;
}

export function formatNumber(value: number | null | undefined, digits = 1, signed = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  // Evita "-0,0": un valor que redondea a cero se muestra sin signo.
  const rounded = Number(value.toFixed(digits));
  return formatter(digits, signed).format(Object.is(rounded, -0) ? 0 : rounded);
}

export function formatDeg(value: number | null | undefined, digits = 1): string {
  const text = formatNumber(value, digits);
  return text === "—" ? text : `${text}°`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  const text = formatNumber(value, digits);
  return text === "—" ? text : `${text} %`;
}

export function formatSeconds(milliseconds: number | null | undefined, digits = 1): string {
  if (milliseconds === null || milliseconds === undefined || !Number.isFinite(milliseconds)) return "—";
  return `${formatNumber(milliseconds / 1000, digits)} s`;
}

/** Número con punto decimal fijo para CSV/JSON (cadena vacía si falta). */
export function csvNumber(value: number | null | undefined, digits = 5): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "" : value.toFixed(digits);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
