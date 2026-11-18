# Guía de laboratorio — ¿Se mueve a velocidad constante? (MRU)

Laboratorio de LabMotion V2 · UMayor INGT1037. Se hace **solo con el teléfono**: el acelerómetro mide el movimiento y la app calcula velocidad y posición. Abre `https://labmotionv2.iroak.dev` en el teléfono (los sensores solo funcionan con HTTPS) y entra a **Labs › Movimiento rectilíneo uniforme (MRU)**.

> Estado: **piloto**. El laboratorio pasó las pruebas con señales sintéticas, pero aún no está validado con teléfonos reales. Trata las cifras como estimaciones.

## 1. Objetivo

Comprobar, con el acelerómetro del teléfono, que un cuerpo que avanza sin que nadie lo empuje mantiene su velocidad (aceleración casi nula) y que su posición crece como una recta en el tiempo.

## 2. Pregunta e hipótesis

- **Pregunta:** si un cuerpo avanza sin que nadie lo empuje, ¿su velocidad se mantiene constante y su posición crece como una recta?
- **Hipótesis:** entre el empujón y el frenado la aceleración medida será casi nula, la velocidad casi constante y la gráfica de posición contra tiempo, una recta.

## 3. Materiales

- Teléfono compatible (Android con Chrome o iPhone con Safari).
- Una superficie horizontal, lisa y despejada de 1 a 2 m (mesa, vidrio o piso liso).
- Idealmente un carrito, una patineta pequeña o algo con ruedas donde apoyar el teléfono.
- Opcional: cinta o regla para medir la distancia recorrida.

## 4. ¿Cómo funciona?

Un acelerómetro mide **aceleración**, no velocidad. Cuando la velocidad es constante, la aceleración es cero, así que durante el crucero el sensor «no ve» nada. Por eso la app mide tres momentos y reconstruye el resto:

1. **Reposo:** antes de empujar, promedia lo que mide el teléfono quieto (gravedad y sesgo del sensor) y lo resta de todas las lecturas siguientes.
2. **Empujón y frenado:** son los dos únicos momentos con aceleración. Integrándolos se obtiene la velocidad, y como el teléfono empieza y termina quieto, la velocidad final tiene que ser cero (lo que sobra es deriva del sensor y se corrige).
3. **Crucero:** el tramo entre ambos, con aceleración casi nula. Ahí se ajusta una recta a la posición: su pendiente es la velocidad.

```
a_movimiento(t) = lectura(t) − promedio(lecturas en reposo)
v = ∫ a · dt          x = ∫ v · dt
v_corregida(t) = v(t) − v_final · (t − t₀) / (t_final − t₀)
x(t) = x₀ + v · t     (ajuste lineal en el crucero)
```

La pestaña **Ciencia** del laboratorio muestra cada paso con el código real que ejecuta la página.

## 5. Procedimiento

### Preparación

1. Abre el laboratorio, toca **Comenzar experimento** y concede el permiso de movimiento.
2. Apoya el teléfono con la pantalla hacia arriba, plano sobre el carrito o la superficie. No lo gires durante la prueba.
3. En **Demostración**, toca **Registrar prueba de MRU**.

### Cada prueba

1. Toca **Preparar** y no toques el teléfono hasta que diga **Listo** (mide el reposo durante poco más de 1 s).
2. Da un empujón **corto y firme** y suelta: deja que avance solo.
3. Al final, **detén el carrito con la mano**. Ese frenado le indica a la app dónde termina el crucero.
4. Espera medio segundo. La app termina sola; también puedes tocar **Terminar**.
5. Opcional: mide con cinta cuánto avanzó desde donde partió hasta donde quedó y anótalo en la app.
6. Repite al menos **3 veces** con la misma superficie.

### Si algo falla

| Mensaje | Qué hacer |
| --- | --- |
| «El teléfono se mueve» | No lo toques mientras mide el reposo. |
| «La superficie está inclinada» | Usa una superficie horizontal: si no, la gravedad lo acelera. |
| «No se detectó el frenado» | Detén el carrito con la mano al final. |
| «No hay un tramo de crucero claro» | Usa una superficie más lisa o algo con ruedas; empuja más fuerte. |
| «Se perdieron muestras» | Mantén la pantalla encendida y la página visible. |

## 6. Registro de datos

La app guarda cada prueba en este navegador. Copia los valores de **Resultados** en esta tabla (o usa **Copiar resumen para el informe**):

| Prueba | v crucero (m/s) | Variación de v (%) | a en el crucero (m/s²) | R² de x(t) | Distancia app (m) | Distancia con cinta (m) |
| --- | --- | --- | --- | --- | --- | --- |
| P1 | | | | | | |
| P2 | | | | | | |
| P3 | | | | | | |
| **Promedio** | | | | | | |

También puedes exportar **CSV de resultados**, **CSV de series** (a, v y x contra tiempo) y **JSON** con los umbrales usados.

## 7. Preguntas para el estudiante

1. ¿Qué velocidad de crucero obtuviste en cada repetición? ¿Cuánto varió entre pruebas?
2. ¿La aceleración en el crucero fue realmente cero? ¿Qué la mantiene distinta de cero?
3. ¿Qué te dice el R² de la gráfica de posición sobre el tipo de movimiento?
4. Si usas una superficie más rugosa, ¿qué esperas que pase con la variación de velocidad? Pruébalo.
5. Compara la distancia que estima la app con la que mediste con cinta. ¿De dónde sale la diferencia?

## 8. Interpretación

- Si la variación de velocidad es **menor a 10 %** y la aceleración en el crucero es **menor a 0,2 m/s²**, los datos son compatibles con un movimiento uniforme en ese tramo. Son los umbrales que usa la conclusión automática.
- Un R² cercano a 1 indica que la posición sigue una recta. Un R² alto no prueba que la velocidad sea exacta.
- Una **deriva** grande (aviso amarillo) significa que la velocidad es menos fiable. Repite la prueba.
- La distancia con cinta es la única referencia independiente del laboratorio: úsala para juzgar el error.
- **No** escribas que el sensor «está calibrado» o que los resultados son «exactos». Las cifras son estimaciones que salen de integrar un acelerómetro.

### ¿Por qué no sale exacto?

- El roce frena el teléfono durante el crucero.
- Integrar dos veces amplifica el ruido: un error pequeño en la aceleración crece con el tiempo.
- El empujón y el frenado son bruscos: el teléfono puede rebotar o girar un poco.
- El navegador y el sistema operativo filtran las lecturas; cada equipo lo hace distinto.
- Si el teléfono giró o la superficie no estaba nivelada, parte de la gravedad se mezcla con el movimiento.

## 9. Notas para el docente

- **Duración:** 20 a 30 minutos con 3 repeticiones por grupo.
- **Qué mide de verdad:** solo el empujón y el frenado tienen aceleración medible. La velocidad de crucero se reconstruye integrando el empujón y exigiendo velocidad final cero; es una estimación, no una medición directa.
- **Superficie:** lo que más condiciona el resultado. Un carrito con ruedas da crucero casi uniforme; una mesa de madera frena el teléfono y no habrá crucero.
- **Umbrales:** los de la prueba (umbral de movimiento, hueco máximo entre muestras, crucero mínimo, deriva aceptada) están en `DEFAULT_MOTION_CONFIG` (`src/labs/motion/motionPhysics.ts`) y se exportan con cada prueba. Ajústalos con pruebas reales de su equipo.
- **Validación pendiente:** el laboratorio se probó con señales sintéticas. Antes de evaluar, hagan una prueba con el teléfono real que usarán y anoten qué pasa.
- **Privacidad:** los datos no salen del teléfono; no hay servidor ni cuentas.
