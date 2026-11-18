import type { MotionKind } from "./motionPhysics";

export type ScienceStep = {
  title: string;
  /** Explicación sencilla, sin fórmulas. */
  simple: string;
  /** Fórmula o resumen del cálculo. */
  formula: string;
  /** Región de `motionPhysics.ts` cuyo código se muestra. */
  region: string;
};

export type GlossaryItem = { term: string; symbol: string; unit: string; meaning: string };

export type LabContent = {
  kind: MotionKind;
  /** Nombre corto para tarjetas y títulos. */
  shortTitle: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  cardSummary: string;
  question: string;
  hypothesis: string;
  materials: string[];
  position: string;
  /** Pasos del procedimiento (se muestran en la demostración). */
  procedure: string[];
  /** Indicaciones que aparecen al estar preparado. */
  tips: string[];
  science: ScienceStep[];
  glossary: GlossaryItem[];
  /** Por qué el resultado no coincide exactamente con la teoría. */
  why: string[];
  /** Preguntas para el informe. */
  questions: string[];
  /** Texto del botón para registrar una prueba. */
  registerLabel: string;
  guideFile: string;
};

const MRU: LabContent = {
  kind: "mru",
  shortTitle: "Movimiento rectilíneo uniforme (MRU)",
  title: "¿Se mueve a velocidad constante?",
  eyebrow: "Laboratorio · MRU",
  subtitle: "Empuja el teléfono sobre una superficie lisa y comprueba si, en el tramo de crucero, la velocidad se mantiene constante.",
  cardSummary: "Solo el acelerómetro del teléfono · empujón, crucero y frenado",
  question: "Si un cuerpo avanza sin que nadie lo empuje, ¿su velocidad se mantiene constante y su posición crece como una recta?",
  hypothesis: "Entre el empujón y el frenado la aceleración medida será casi nula, la velocidad casi constante y la gráfica de posición contra tiempo, una recta.",
  materials: [
    "Teléfono compatible (Android con Chrome o iPhone con Safari)",
    "Una superficie horizontal, lisa y despejada de 1 a 2 m (mesa, vidrio o piso liso)",
    "Idealmente un carrito, una patineta pequeña o algo con ruedas donde apoyar el teléfono",
    "Opcional: cinta o regla para medir la distancia recorrida",
  ],
  position: "Teléfono con la pantalla hacia arriba, plano sobre el carrito o la superficie. No lo gires durante la prueba.",
  procedure: [
    "Apoya el teléfono, con la pantalla hacia arriba, sobre el carrito o la superficie lisa.",
    "Toca «Preparar» y no lo toques hasta que diga «Listo».",
    "Empuja de forma breve y suelta: deja que avance solo.",
    "Detén el carrito con la mano al final. Ese frenado le indica a la app dónde termina el crucero.",
    "Espera medio segundo y revisa los resultados.",
  ],
  tips: [
    "Un empujón corto y firme funciona mejor que uno largo y suave.",
    "Cuanto más lisa la superficie, más uniforme el movimiento: el roce es lo que frena el teléfono.",
    "Mantén el teléfono plano y apuntando en la misma dirección durante toda la prueba.",
  ],
  science: [
    {
      title: "Línea base en reposo",
      simple: "Antes de empujar, el teléfono promedia lo que mide quieto. Eso incluye la gravedad y los pequeños sesgos del sensor, y se resta de todas las lecturas siguientes.",
      formula: "a_movimiento(t) = lectura(t) − promedio(lecturas en reposo)",
      region: "lineaBase",
    },
    {
      title: "Dirección del movimiento",
      simple: "No importa cómo apoyes el teléfono: la app busca la recta en la que apunta la aceleración y mide solo a lo largo de ella. El sentido del empujón es el positivo.",
      formula: "eje = autovector mayor de M = [Σax²  Σaxay; Σaxay  Σay²]",
      region: "ejeDeMovimiento",
    },
    {
      title: "De aceleración a velocidad y posición",
      simple: "Sumar la aceleración instante a instante da la velocidad; sumar la velocidad da la posición. Se hace con la regla del trapecio.",
      formula: "v = ∫a·dt      x = ∫v·dt",
      region: "integracion",
    },
    {
      title: "Velocidad final igual a cero",
      simple: "El teléfono empieza y termina quieto. Si la velocidad final no sale cero, la diferencia es deriva del sensor, y se resta de forma proporcional al tiempo.",
      formula: "v_corregida(t) = v(t) − v_final·(t − t₀)/(t_final − t₀)",
      region: "ceroDeVelocidad",
    },
    {
      title: "Ajuste de la recta x(t)",
      simple: "En el tramo de crucero se ajusta una recta a la posición. Su pendiente es la velocidad, y R² dice qué tan bien los puntos siguen esa recta.",
      formula: "x(t) = x₀ + v·t      R² = 1 − Σresiduo² / Σ(x − x̄)²",
      region: "ajustes",
    },
  ],
  glossary: [
    { term: "Línea base", symbol: "a₀", unit: "m/s²", meaning: "Lo que mide el acelerómetro con el teléfono quieto. Se resta para quedarse solo con el movimiento." },
    { term: "Empujón", symbol: "a > 0", unit: "m/s²", meaning: "Tramo en que la aceleración sube sobre el umbral y la velocidad aumenta." },
    { term: "Crucero", symbol: "a ≈ 0", unit: "m/s²", meaning: "Tramo a velocidad alta con aceleración casi nula. Es el movimiento rectilíneo uniforme." },
    { term: "Frenado", symbol: "a < 0", unit: "m/s²", meaning: "Tramo final en que la velocidad baja a cero. Marca el final del crucero." },
    { term: "Velocidad de crucero", symbol: "v", unit: "m/s", meaning: "Velocidad media en el tramo de crucero." },
    { term: "Variación de velocidad", symbol: "σv / v", unit: "%", meaning: "Cuánto cambia la velocidad en el crucero respecto de su valor medio. Cerca de 0 % es movimiento uniforme." },
    { term: "Deriva", symbol: "Δv", unit: "m/s", meaning: "Error acumulado por integrar un sensor con ruido. Se estima con la velocidad final y se corrige." },
    { term: "R²", symbol: "R²", unit: "—", meaning: "Qué tan cerca está x(t) de una recta. 1 es una recta perfecta." },
  ],
  why: [
    "Roce: ninguna superficie es perfecta, así que el teléfono se frena un poco durante el crucero.",
    "Integrar dos veces amplifica el ruido: un error pequeño en la aceleración crece con el tiempo.",
    "El empujón y el frenado son breves y bruscos: el teléfono puede rebotar o girar un poco.",
    "El navegador y el sistema operativo filtran las lecturas del acelerómetro; cada equipo lo hace distinto.",
    "Si el teléfono giró o la superficie no estaba nivelada, parte de la gravedad se mezcla con el movimiento.",
  ],
  questions: [
    "¿Qué valor de velocidad de crucero obtuviste en cada repetición? ¿Cuánto varió entre pruebas?",
    "¿La aceleración en el crucero fue realmente cero? ¿Qué la mantiene distinta de cero?",
    "¿Qué te dice el R² de la gráfica de posición sobre el tipo de movimiento?",
    "Si usas una superficie más rugosa, ¿qué esperas que pase con la variación de velocidad? Pruébalo.",
    "Compara la distancia que estima la app con la que mediste con cinta. ¿De dónde sale la diferencia?",
  ],
  registerLabel: "Registrar prueba de MRU",
  guideFile: "GUIA-MRU.md",
};

const MRUA: LabContent = {
  kind: "mrua",
  shortTitle: "Movimiento rectilíneo uniformemente acelerado (MRUA)",
  title: "¿Cuánto acelera en una rampa?",
  eyebrow: "Laboratorio · MRUA",
  subtitle: "Deja que el teléfono baje por una tabla inclinada y compara su aceleración con la que predice la teoría.",
  cardSummary: "Solo el acelerómetro del teléfono · rampa inclinada y g·sen θ",
  question: "Si un cuerpo baja por un plano inclinado, ¿su aceleración es constante y cuánto vale comparada con g·sen θ?",
  hypothesis: "La aceleración será constante y algo menor que g·sen θ por el roce; la velocidad crecerá en línea recta y la posición, como una parábola.",
  materials: [
    "Teléfono compatible (Android con Chrome o iPhone con Safari)",
    "Una tabla o un libro grande y liso, apoyado de modo que forme una rampa de 10° a 30°",
    "Un tope blando abajo (una toalla o un cojín) para recibir el teléfono",
    "Opcional: cinta o regla para medir el recorrido",
  ],
  position: "Teléfono con la pantalla hacia arriba, plano sobre la rampa y con la parte de arriba apuntando cuesta arriba. No lo gires durante la prueba.",
  procedure: [
    "Arma la rampa y colócala firme: no debe moverse cuando el teléfono baje.",
    "Apoya el teléfono arriba de la rampa, sosteniéndolo con un dedo.",
    "Toca «Preparar» y no lo muevas hasta que diga «Listo»: en ese momento mide la inclinación.",
    "Suéltalo sin empujarlo y deja que baje solo hasta el tope blando.",
    "Revisa los resultados y repite al menos tres veces con la misma inclinación.",
  ],
  tips: [
    "Usa una superficie lisa: si el teléfono no se desliza, aumenta la inclinación.",
    "La rampa debe tener al menos 60 cm, para que haya más de medio segundo de aceleración constante.",
    "Mantén el teléfono recto: si se tuerce en la bajada, el resultado se degrada.",
    "Pon el tope blando: un golpe fuerte puede dañar el teléfono y no aporta datos útiles.",
  ],
  science: [
    {
      title: "Línea base e inclinación",
      simple: "Con el teléfono quieto en la rampa, el acelerómetro mide la gravedad repartida entre sus ejes. De ahí sale la inclinación θ, y esa lectura se resta después para aislar el movimiento.",
      formula: "θ = atan2(√(gx² + gy²), |gz|)      a_movimiento(t) = lectura(t) − base",
      region: "lineaBase",
    },
    {
      title: "Dirección del movimiento",
      simple: "La app busca la recta en que apunta la aceleración y mide a lo largo de ella; además comprueba que coincida con la línea de máxima pendiente.",
      formula: "eje = autovector mayor de M = [Σax²  Σaxay; Σaxay  Σay²]",
      region: "ejeDeMovimiento",
    },
    {
      title: "Velocidad y posición",
      simple: "El teléfono parte del reposo: sumar la aceleración instante a instante da la velocidad, y sumar la velocidad da la posición.",
      formula: "v = ∫a·dt      x = ∫v·dt",
      region: "integracion",
    },
    {
      title: "Ajustes: recta y parábola",
      simple: "Si la aceleración es constante, v(t) es una recta cuya pendiente es la aceleración, y x(t) es una parábola cuyo coeficiente cuadrático es a/2.",
      formula: "v = v₀ + a·t      x = x₀ + v₀·t + ½·a·t²",
      region: "ajustes",
    },
    {
      title: "Comparación con la teoría",
      simple: "Sin roce, el teléfono aceleraría g·sen θ. El roce lo reduce, y de la diferencia se estima el coeficiente de roce cinético.",
      formula: "a_ideal = g·sen θ      μ = tan θ − a / (g·cos θ)",
      region: "comparacionTeorica",
    },
  ],
  glossary: [
    { term: "Inclinación de la rampa", symbol: "θ", unit: "°", meaning: "Ángulo entre la rampa y la horizontal, medido por el propio teléfono en reposo." },
    { term: "Aceleración medida", symbol: "a", unit: "m/s²", meaning: "Aceleración media del teléfono a lo largo de la rampa durante la meseta." },
    { term: "Aceleración sin roce", symbol: "g·sen θ", unit: "m/s²", meaning: "Lo que aceleraría el teléfono si no hubiera roce. Es el máximo teórico." },
    { term: "Coeficiente de roce cinético", symbol: "μ", unit: "—", meaning: "Estimación de cuánto frena el roce, a partir de la diferencia con g·sen θ. Un valor negativo indica un problema de medición." },
    { term: "Meseta", symbol: "a ≈ cte", unit: "—", meaning: "Tramo de aceleración casi constante, entre el inicio de la bajada y el choque con el tope." },
    { term: "Pendiente de v(t)", symbol: "m", unit: "m/s²", meaning: "Pendiente de la recta velocidad–tiempo: es la aceleración." },
    { term: "Coeficiente cuadrático", symbol: "c₂", unit: "m/s²", meaning: "Coeficiente de t² en la parábola x(t): vale la mitad de la aceleración." },
    { term: "R²", symbol: "R²", unit: "—", meaning: "Qué tan bien una recta (o una parábola) describe los datos. 1 es un ajuste perfecto." },
  ],
  why: [
    "Roce: la aceleración medida queda por debajo de g·sen θ; justamente esa diferencia es lo que se estima como μ.",
    "Si el teléfono rueda o vibra sobre la superficie, la aceleración no es perfectamente constante.",
    "La rampa puede ceder o moverse un poco, y el teléfono puede torcerse durante la bajada.",
    "El ángulo se mide con el mismo sensor: un error de 1° en θ cambia g·sen θ en cerca de un 6 % a 15°.",
    "El navegador y el sistema operativo filtran las lecturas del acelerómetro; cada equipo lo hace distinto.",
  ],
  questions: [
    "¿Qué aceleración mediste en cada repetición y cuánto varió entre ellas?",
    "¿Cuánto vale g·sen θ con tu ángulo? ¿Por qué la aceleración medida es menor?",
    "¿Qué coeficiente de roce estimaste? ¿Es razonable para esa superficie?",
    "¿Qué forma tiene la gráfica de velocidad y cuál la de posición? ¿Qué te dice eso sobre el tipo de movimiento?",
    "Cambia la inclinación y repite. ¿Cómo cambia la aceleración y qué relación tiene con sen θ?",
  ],
  registerLabel: "Registrar prueba de MRUA",
  guideFile: "GUIA-MRUA.md",
};

export const LAB_CONTENT: Record<MotionKind, LabContent> = { mru: MRU, mrua: MRUA };
