import { csvNumber } from "../../lib/format";
import { DEFAULT_MOTION_CONFIG, MOTION_CALC_VERSION, type MotionKind } from "./motionPhysics";
import { referenceComparison, type MotionTrial } from "./motionSession";

export const MOTION_EXPORT_FORMAT: Record<MotionKind, string> = {
  mru: "labmotion-mru-session-v1",
  mrua: "labmotion-mrua-session-v1",
};

export type MotionExportContext = {
  device: string;
  exportedAt?: Date;
};

/** Escapa un campo CSV (comillas, comas y saltos de línea). */
export function csvText(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const fix = (value: number | null | undefined, digits = 4) => csvNumber(value, digits);

const MRU_COLUMNS = [
  "prueba",
  "fecha",
  "calidad",
  "v_crucero_m_s",
  "variacion_v_pct",
  "a_crucero_m_s2",
  "crucero_desde_s",
  "crucero_hasta_s",
  "pendiente_x_m_s",
  "r2_x",
  "distancia_crucero_m",
  "distancia_total_m",
  "distancia_cinta_m",
  "error_distancia_m",
  "error_distancia_pct",
  "deriva_removida_m_s",
  "v_pico_m_s",
  "frecuencia_hz",
  "fuente",
  "avisos",
];

const MRUA_COLUMNS = [
  "prueba",
  "fecha",
  "calidad",
  "theta_deg",
  "g_m_s2",
  "a_medida_m_s2",
  "a_desviacion_m_s2",
  "a_ideal_m_s2",
  "diferencia_pct",
  "mu_estimado",
  "pendiente_v_m_s2",
  "r2_v",
  "a_desde_x_m_s2",
  "r2_x",
  "distancia_total_m",
  "distancia_cinta_m",
  "error_distancia_m",
  "error_distancia_pct",
  "alineacion",
  "frecuencia_hz",
  "fuente",
  "avisos",
];

/** CSV de resultados: una fila por prueba, una sola cabecera, punto decimal. */
export function trialsCsv(kind: MotionKind, trials: readonly MotionTrial[]): string {
  const own = trials.filter((trial) => trial.kind === kind);
  const header = (kind === "mru" ? MRU_COLUMNS : MRUA_COLUMNS).join(",");
  const rows = own.map((trial) => {
    const a = trial.analysis;
    const comparison = referenceComparison(trial);
    const common = [`P${trial.attempt}`, trial.createdAt, trial.quality];
    const tail = [
      fix(a.rateHz, 1),
      a.source,
      csvText(a.warnings.join(" | ")),
    ];
    const reference = [
      fix(trial.referenceM, 3),
      fix(comparison?.absolute, 3),
      fix(comparison?.percent, 2),
    ];
    if (kind === "mru" && a.mru) {
      const r = a.mru;
      return [
        ...common,
        fix(r.vCruise),
        fix(r.vVariation * 100, 2),
        fix(r.aCruise),
        fix(r.cruiseFromS, 3),
        fix(r.cruiseToS, 3),
        fix(r.xFit.slope),
        fix(r.xFit.r2, 5),
        fix(r.cruiseDistance),
        fix(r.totalDistance),
        ...reference,
        fix(r.driftRemoved),
        fix(r.vPeak),
        ...tail,
      ].join(",");
    }
    const r = a.mrua;
    return [
      ...common,
      fix(r?.thetaDeg, 2),
      fix(r?.gravity, 3),
      fix(r?.aMean),
      fix(r?.aStd),
      fix(r?.aIdeal),
      fix(r?.aDiffPercent, 2),
      fix(r?.mu, 4),
      fix(r?.vFit.slope),
      fix(r?.vFit.r2, 5),
      fix(r ? 2 * r.xFit.c2 : null),
      fix(r?.xFit.r2, 5),
      fix(r?.totalDistance),
      ...reference,
      fix(r?.alignment, 4),
      ...tail,
    ].join(",");
  });
  return [header, ...rows].join("\n");
}

/** CSV de la serie a(t), v(t), x(t) de cada prueba. */
export function samplesCsv(kind: MotionKind, trials: readonly MotionTrial[]): string {
  const rows = trials
    .filter((trial) => trial.kind === kind)
    .flatMap((trial) => trial.analysis.series.map((point) => [`P${trial.attempt}`, fix(point.t, 4), fix(point.a, 4), fix(point.v, 4), fix(point.x, 4)].join(",")));
  return ["prueba,t_s,a_m_s2,v_m_s,x_m", ...rows].join("\n");
}

/** Sesión completa, con los umbrales usados y la versión del cálculo. */
export function sessionJson(kind: MotionKind, trials: readonly MotionTrial[], context: MotionExportContext): string {
  return JSON.stringify(
    {
      format: MOTION_EXPORT_FORMAT[kind],
      calcVersion: MOTION_CALC_VERSION,
      kind,
      exportedAt: (context.exportedAt ?? new Date()).toISOString(),
      device: context.device,
      simulated: false,
      defaultConfig: DEFAULT_MOTION_CONFIG,
      trials: trials.filter((trial) => trial.kind === kind),
    },
    null,
    2,
  );
}
