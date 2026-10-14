import type { DataKind } from "./TiltParts";

export type GlossaryKey =
  | "aTotal"
  | "aLinear"
  | "gravity"
  | "gravityMagnitude"
  | "theta"
  | "frequency"
  | "window"
  | "std"
  | "rotation"
  | "reference"
  | "absError"
  | "percentError";

export type GlossaryEntry = {
  title: string;
  symbol: string;
  unit: string;
  kind: DataKind;
  meaning: string;
  origin: string;
};

/** Qué significa cada magnitud y de dónde sale (se abre al tocarla en Ciencia). */
export const TILT_GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  aTotal: {
    title: "Aceleración incluyendo gravedad",
    symbol: "a_total = (ax_total, ay_total, az_total)",
    unit: "m/s²",
    kind: "directa",
    meaning: "Lo que percibe el acelerómetro en cada eje del teléfono: la gravedad más cualquier aceleración del movimiento. Quieto y plano, casi todo aparece en Z.",
    origin: "La entrega el navegador en DeviceMotionEvent.accelerationIncludingGravity.",
  },
  aLinear: {
    title: "Aceleración lineal",
    symbol: "a = (ax, ay, az)",
    unit: "m/s²",
    kind: "directa",
    meaning: "La parte de la aceleración que se debe al movimiento, sin la gravedad. Con el teléfono quieto debería ser casi cero.",
    origin: "La entrega el navegador en DeviceMotionEvent.acceleration (el sistema operativo la estima). Algunos navegadores no la entregan.",
  },
  gravity: {
    title: "Vector de gravedad estimado",
    symbol: "g = a_total − a",
    unit: "m/s²",
    kind: "derivada",
    meaning: "La dirección de la gravedad vista desde los ejes del teléfono. Al inclinarlo, la gravedad se reparte de otra forma entre X, Y y Z.",
    origin: "La calcula LabMotion restando, eje por eje, la aceleración lineal a la aceleración con gravedad. Ambas lecturas vienen del mismo sistema de sensores.",
  },
  gravityMagnitude: {
    title: "Magnitud de la gravedad estimada",
    symbol: "|g| = √(gx² + gy² + gz²)",
    unit: "m/s²",
    kind: "derivada",
    meaning: "El tamaño del vector g. En reposo debería acercarse a 9,81 m/s²; ese valor se muestra solo como referencia explicativa, no como validación.",
    origin: "La calcula LabMotion con las tres componentes de g.",
  },
  theta: {
    title: "Ángulo de inclinación",
    symbol: "θ = atan2(√(gx² + gy²), |gz|)",
    unit: "°",
    kind: "derivada",
    meaning: "Cuánto se inclina la pantalla respecto a la horizontal: 0° plana, 90° vertical. No indica hacia qué lado se inclinó.",
    origin: "La calcula LabMotion comparando la parte de la gravedad que queda en el plano de la pantalla (X, Y) con la que queda perpendicular (Z).",
  },
  frequency: {
    title: "Frecuencia de muestreo efectiva",
    symbol: "f = (N − 1) / (t_N − t_1)",
    unit: "Hz",
    kind: "derivada",
    meaning: "Cuántas muestras llegan por segundo. Se mide con los tiempos reales de llegada, no con el intervalo que declara el navegador.",
    origin: "La calcula LabMotion con los tiempos de las muestras del último segundo.",
  },
  window: {
    title: "Ventana de estabilidad",
    symbol: "Δt_ventana",
    unit: "s",
    kind: "parametro",
    meaning: "Intervalo reciente que se revisa para decidir si el teléfono está quieto. Una prueba solo se registra si toda su ventana de medición es estable.",
    origin: "Parámetro configurable del laboratorio. Cumplirlo no demuestra precisión: solo indica que la lectura no estaba cambiando.",
  },
  std: {
    title: "Desviación estándar",
    symbol: "σ",
    unit: "°",
    kind: "derivada",
    meaning: "Cuánto varían los ángulos alrededor de su promedio. Un valor pequeño indica una lectura quieta, no necesariamente correcta.",
    origin: "La calcula LabMotion con las lecturas de la ventana (desviación muestral, N − 1).",
  },
  rotation: {
    title: "Velocidad angular",
    symbol: "|ω|",
    unit: "°/s",
    kind: "directa",
    meaning: "Rapidez de giro del teléfono. Solo se usa para detectar movimiento; no entra en la fórmula del ángulo.",
    origin: "La entrega el navegador en DeviceMotionEvent.rotationRate (giroscopio), si existe.",
  },
  reference: {
    title: "Ángulo de referencia",
    symbol: "θ_ref",
    unit: "°",
    kind: "parametro",
    meaning: "El ángulo del soporte medido con un transportador físico. Es la comparación independiente del experimento.",
    origin: "Lo ingresa el estudiante al registrar cada prueba.",
  },
  absError: {
    title: "Error absoluto",
    symbol: "|θ̄ − θ_ref|",
    unit: "°",
    kind: "derivada",
    meaning: "Cuántos grados separan el promedio medido de la referencia física.",
    origin: "Lo calcula LabMotion con el promedio de la ventana estable y la referencia ingresada.",
  },
  percentError: {
    title: "Error porcentual",
    symbol: "|θ̄ − θ_ref| / |θ_ref| × 100",
    unit: "%",
    kind: "derivada",
    meaning: "El error absoluto relativo al tamaño de la referencia. Con referencia 0° no aplica (dividiría por cero); se informa solo el error absoluto.",
    origin: "Lo calcula LabMotion.",
  },
};
