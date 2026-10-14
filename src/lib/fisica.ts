export type Vector3 = {
  x: number;
  y: number;
  z: number;
};

export type CalculationDefinition = {
  id: string;
  title: string;
  symbol: string;
  unit: string;
  kind: "directa" | "derivada";
  description: string;
  formula: string;
  source: string;
  /** Archivo del que se extrae el código mostrado en la tarjeta. */
  sourceFile?: "fisica" | "tilt";
  region?: string;
};

// #region magnitudDeVector
/**
 * Magnitud de un vector de tres componentes.
 * |v| = raiz(x^2 + y^2 + z^2)
 */
export function magnitudDeVector(vector: Vector3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}
// #endregion

// #region gravedadEstimada
/**
 * Separa la gravedad de la aceleracion total que entrega el sensor.
 * g = aceleracionConGravedad - aceleracionLineal
 */
export function gravedadEstimada(
  aceleracionConGravedad: Vector3,
  aceleracionLineal: Vector3,
): Vector3 {
  return {
    x: aceleracionConGravedad.x - aceleracionLineal.x,
    y: aceleracionConGravedad.y - aceleracionLineal.y,
    z: aceleracionConGravedad.z - aceleracionLineal.z,
  };
}
// #endregion

// #region inclinacionRespectoVertical
/**
 * Angulo entre el vector de gravedad y el eje Z del telefono (0-180 grados).
 * theta = arccos(g_z / |g|)
 * El resultado depende del signo de g_z: segun el navegador, la pantalla
 * hacia arriba puede dar 0 o 180 grados. El laboratorio de inclinacion usa
 * inclinacionDeSuperficie (0-90 grados, sin signo).
 */
export function inclinacionRespectoVertical(gravedad: Vector3): number {
  const magnitud = magnitudDeVector(gravedad);
  if (magnitud === 0) return 0;
  const coseno = Math.max(-1, Math.min(1, gravedad.z / magnitud));
  return (Math.acos(coseno) * 180) / Math.PI;
}
// #endregion

// #region integrarTrapecio
/**
 * Area bajo la curva entre dos muestras usando la regla del trapecio.
 * integral = ((valorAnterior + valorActual) / 2) * delta_t
 */
export function integrarTrapecio(
  valorAnterior: number,
  valorActual: number,
  deltaSeconds: number,
): number {
  return ((valorAnterior + valorActual) / 2) * deltaSeconds;
}
// #endregion

// #region frecuenciaDeMuestreo
/**
 * Frecuencia media de una serie de muestras.
 * frecuencia = (muestras - 1) / tiempo_transcurrido
 */
export function frecuenciaDeMuestreo(
  tiemposMs: readonly number[],
): number | null {
  if (tiemposMs.length < 2) return null;
  const tiempoTranscurridoMs = tiemposMs[tiemposMs.length - 1] - tiemposMs[0];
  return tiempoTranscurridoMs > 0
    ? ((tiemposMs.length - 1) / tiempoTranscurridoMs) * 1000
    : null;
}
// #endregion

// #region anguloGirado
/**
 * Integra una velocidad angular para estimar el angulo girado.
 * Los tramos con datos faltantes no se conectan artificialmente.
 */
export function anguloGirado(
  muestras: readonly { tMs: number; velocidad: number | null }[],
): number {
  let angulo = 0;
  let anterior: { tMs: number; velocidad: number } | null = null;

  for (const muestra of muestras) {
    if (muestra.velocidad === null) {
      anterior = null;
      continue;
    }

    if (anterior !== null) {
      const deltaSeconds = Math.min((muestra.tMs - anterior.tMs) / 1000, 0.25);
      if (deltaSeconds > 0) {
        angulo += integrarTrapecio(anterior.velocidad, muestra.velocidad, deltaSeconds);
      }
    }

    anterior = { tMs: muestra.tMs, velocidad: muestra.velocidad };
  }

  return angulo;
}
// #endregion

// #region errorRelativo
/**
 * Diferencia porcentual entre un valor medido y una referencia.
 */
export function errorRelativo(medido: number, referencia: number): number | null {
  if (!Number.isFinite(medido) || referencia === 0) return null;
  return (Math.abs(medido - referencia) / Math.abs(referencia)) * 100;
}
// #endregion

export const CALCULATION_CATALOG: CalculationDefinition[] = [
  {
    id: "linear-acceleration",
    title: "Aceleración lineal",
    symbol: "a_x, a_y, a_z",
    unit: "m/s²",
    kind: "directa",
    description: "Aceleración del movimiento sin la gravedad, estimada por el sistema operativo en cada eje.",
    formula: "a = (a_x, a_y, a_z)",
    source: "DeviceMotionEvent.acceleration",
  },
  {
    id: "gravity-acceleration",
    title: "Aceleración con gravedad",
    symbol: "a + g",
    unit: "m/s²",
    kind: "directa",
    description: "Lectura del acelerómetro que conserva la aceleración del movimiento y la gravedad.",
    formula: "a_total = ((a+g)_x, (a+g)_y, (a+g)_z)",
    source: "DeviceMotionEvent.accelerationIncludingGravity",
  },
  {
    id: "angular-velocity",
    title: "Velocidad angular",
    symbol: "α, β, γ",
    unit: "°/s",
    kind: "directa",
    description: "Rapidez de giro: α alrededor del eje Z, β alrededor del eje X y γ alrededor del eje Y.",
    formula: "ω = (α, β, γ)",
    source: "DeviceMotionEvent.rotationRate",
  },
  {
    id: "orientation",
    title: "Orientación",
    symbol: "α, β, γ",
    unit: "°",
    kind: "directa",
    description: "Ángulos de orientación del sistema operativo: α (0–360°), β (−180–180°), γ (−90–90°).",
    formula: "orientación = (α, β, γ)",
    source: "DeviceOrientationEvent",
  },
  {
    id: "sample-interval",
    title: "Intervalo informado",
    symbol: "Δt",
    unit: "ms",
    kind: "directa",
    description: "Intervalo que el navegador declara entre muestras. Puede no coincidir con el tiempo real de llegada.",
    formula: "Δt = DeviceMotionEvent.interval",
    source: "DeviceMotionEvent.interval",
  },
  {
    id: "magnitude",
    title: "Magnitud de aceleración",
    symbol: "|a|",
    unit: "m/s²",
    kind: "derivada",
    description: "Una sola cifra resume la aceleración lineal de los tres ejes.",
    formula: "|a| = √(a_x² + a_y² + a_z²)",
    source: "Cálculo a partir de acceleration",
    sourceFile: "fisica",
    region: "magnitudDeVector",
  },
  {
    id: "estimated-gravity",
    title: "Gravedad estimada",
    symbol: "|g|",
    unit: "m/s²",
    kind: "derivada",
    description: "Resta la aceleración lineal de la lectura que incluye gravedad. Ambas lecturas vienen del mismo sistema de sensores: no es una referencia independiente.",
    formula: "g = (a + g) − a",
    source: "Dos lecturas de DeviceMotionEvent",
    sourceFile: "fisica",
    region: "gravedadEstimada",
  },
  {
    id: "lab-tilt",
    title: "Inclinación de la pantalla (laboratorio)",
    symbol: "θ",
    unit: "°",
    kind: "derivada",
    description: "Inclinación de la pantalla respecto a la horizontal, sin signo, entre 0° (plano) y 90° (vertical). Es la que usa el laboratorio.",
    formula: "θ = atan2(√(g_x² + g_y²), |g_z|)",
    source: "Cálculo a partir de gravedad estimada",
    sourceFile: "tilt",
    region: "inclinacionDeSuperficie",
  },
  {
    id: "tilt",
    title: "Ángulo entre el eje Z y la gravedad",
    symbol: "θ_z",
    unit: "°",
    kind: "derivada",
    description: "Ángulo de 0° a 180°; depende del signo de g_z, que cambia según el navegador. Se conserva como referencia del cálculo anterior.",
    formula: "θ_z = arccos(g_z / |g|)",
    source: "Cálculo a partir de gravedad estimada",
    sourceFile: "fisica",
    region: "inclinacionRespectoVertical",
  },
  {
    id: "frequency",
    title: "Frecuencia de muestreo efectiva",
    symbol: "f",
    unit: "Hz",
    kind: "derivada",
    description: "Muestras recibidas por segundo, medidas con los tiempos reales de llegada.",
    formula: "f = (N − 1) / (t_N − t_1)",
    source: "Tiempos de las muestras",
    sourceFile: "fisica",
    region: "frecuenciaDeMuestreo",
  },
  {
    id: "velocity",
    title: "Velocidad estimada (eje X)",
    symbol: "v_x",
    unit: "m/s",
    kind: "derivada",
    description: "Integra la aceleración lineal del eje X desde velocidad inicial cero. Acumula deriva: es exploratoria.",
    formula: "v_n = v_(n−1) + ∫ a dt",
    source: "Integración trapezoidal de aceleración",
    sourceFile: "fisica",
    region: "integrarTrapecio",
  },
  {
    id: "position",
    title: "Posición estimada (eje X)",
    symbol: "x",
    unit: "m",
    kind: "derivada",
    description: "Integra la velocidad estimada para obtener un desplazamiento relativo. Acumula deriva: es exploratoria.",
    formula: "x_n = x_(n−1) + ∫ v dt",
    source: "Segunda integración en eje X",
    sourceFile: "fisica",
    region: "integrarTrapecio",
  },
  {
    id: "rotated-angle",
    title: "Ángulo girado (alrededor de Z)",
    symbol: "Δφ",
    unit: "°",
    kind: "derivada",
    description: "Integra la velocidad angular α para estimar cuánto giró el teléfono sobre su eje Z.",
    formula: "Δφ = ∫ α dt",
    source: "Integración trapezoidal de rotationRate.alpha",
    sourceFile: "fisica",
    region: "anguloGirado",
  },
];
