# Guía de laboratorio — ¿Cuánto acelera en una rampa? (MRUA)

Laboratorio de LabMotion V2 · UMayor INGT1037. Se hace **solo con el teléfono**: el acelerómetro mide la inclinación de la rampa y la aceleración con que baja el propio teléfono. Abre `https://labmotionv2.iroak.dev` en el teléfono (los sensores solo funcionan con HTTPS) y entra a **Labs › Movimiento uniformemente acelerado (MRUA)**.

> Estado: **piloto**. El laboratorio pasó las pruebas con señales sintéticas, pero aún no está validado con teléfonos reales. Trata las cifras como estimaciones.

## 1. Objetivo

Comprobar que un cuerpo que baja por un plano inclinado se mueve con aceleración constante (velocidad lineal, posición cuadrática) y comparar esa aceleración con la teórica sin roce, g·sen θ.

## 2. Pregunta e hipótesis

- **Pregunta:** si un cuerpo baja por un plano inclinado, ¿su aceleración es constante y cuánto vale comparada con g·sen θ?
- **Hipótesis:** la aceleración será constante y algo menor que g·sen θ por el roce; la velocidad crecerá en línea recta y la posición, como una parábola.

## 3. Materiales

- Teléfono compatible (Android con Chrome o iPhone con Safari).
- Una tabla o un libro grande y liso, apoyado de modo que forme una rampa de 10° a 30° (la app acepta de 3° a 60°).
- Un tope blando abajo (una toalla o un cojín) para recibir el teléfono.
- Opcional: cinta o regla para medir el recorrido.

## 4. ¿Cómo funciona?

1. **Inclinación.** Con el teléfono quieto en la rampa, el acelerómetro mide la gravedad repartida entre sus ejes. De ahí sale el ángulo θ: la app no necesita un transportador.
2. **Línea base.** Esa misma lectura en reposo se resta de todas las siguientes, y queda solo la aceleración con que se mueve el teléfono. La app busca además la recta del movimiento y comprueba que coincida con la línea de máxima pendiente.
3. **Velocidad y posición.** El teléfono parte del reposo: sumar la aceleración da la velocidad, y sumar la velocidad da la posición.
4. **Ajustes.** En el tramo de aceleración constante (la «meseta») se ajusta una recta a v(t) y una parábola a x(t).
5. **Comparación con la teoría.** Sin roce, el teléfono aceleraría g·sen θ. El roce lo reduce, y de la diferencia se estima el coeficiente de roce cinético.

```
θ = atan2(√(gx² + gy²), |gz|)        a_movimiento(t) = lectura(t) − lectura en reposo
v = ∫ a · dt                           x = ∫ v · dt
v = v₀ + a · t                         x = x₀ + v₀ · t + ½ · a · t²
a_ideal = g · sen θ                    μ = tan θ − a / (g · cos θ)
```

La pestaña **Ciencia** del laboratorio muestra cada paso con el código real que ejecuta la página.

## 5. Procedimiento

### Preparación

1. Arma la rampa y colócala firme: no debe moverse cuando el teléfono baje. Pon el tope blando abajo.
2. Abre el laboratorio, toca **Comenzar experimento** y concede el permiso de movimiento.
3. En **Demostración**, toca **Registrar prueba de MRUA**.

### Cada prueba

1. Apoya el teléfono arriba de la rampa, con la pantalla hacia arriba, sosteniéndolo con un dedo.
2. Toca **Preparar** y no lo muevas hasta que diga **Listo** (ahí mide la inclinación).
3. **Suéltalo sin empujarlo.** Baja solo hasta el tope blando.
4. Espera medio segundo. La app termina sola; también puedes tocar **Terminar**.
5. Opcional: mide con cinta el recorrido desde donde lo soltaste hasta el tope y anótalo en la app.
6. Repite al menos **3 veces** con la misma inclinación. Después puedes cambiarla y repetir.

### Si algo falla

| Mensaje | Qué hacer |
| --- | --- |
| «El teléfono se mueve» | Sostenlo quieto mientras mide el reposo. |
| «La rampa está casi horizontal» | Aumenta la inclinación (mínimo 3°). |
| «No se detectó movimiento» | Si no se desliza, aumenta la inclinación o usa una superficie más lisa. |
| «El tramo de aceleración constante dura menos de 500 ms» | Usa una rampa más larga (al menos 60 cm) o más suave. |
| «El teléfono giró» | Mantenlo recto durante toda la bajada. |
| «Se perdieron muestras» | Mantén la pantalla encendida y la página visible. |

## 6. Registro de datos

La app guarda cada prueba en este navegador. Copia los valores de **Resultados** en esta tabla (o usa **Copiar resumen para el informe**):

| Prueba | θ (°) | a medida (m/s²) | g·sen θ (m/s²) | Diferencia (%) | μ estimado | R² de v(t) | Distancia app (m) | Distancia con cinta (m) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | | | | | | | | |
| P2 | | | | | | | | |
| P3 | | | | | | | | |
| **Promedio** | | | | | | | | |

También puedes exportar **CSV de resultados**, **CSV de series** (a, v y x contra tiempo) y **JSON** con los umbrales usados.

## 7. Preguntas para el estudiante

1. ¿Qué aceleración mediste en cada repetición y cuánto varió entre ellas?
2. ¿Cuánto vale g·sen θ con tu ángulo? ¿Por qué la aceleración medida es menor?
3. ¿Qué coeficiente de roce estimaste? ¿Es razonable para esa superficie?
4. ¿Qué forma tiene la gráfica de velocidad y cuál la de posición? ¿Qué te dice eso sobre el tipo de movimiento?
5. Cambia la inclinación y repite. ¿Cómo cambia la aceleración y qué relación tiene con sen θ?

## 8. Interpretación

- Una recta en v(t) con R² cercano a 1 y una parábola en x(t) son la señal del movimiento uniformemente acelerado. La app también compara la pendiente de v(t) con 2·c₂ de x(t): deberían coincidir.
- La aceleración medida debería quedar **por debajo** de g·sen θ. Si queda por encima, el μ estimado sale negativo y la app avisa: revisa que la rampa no se haya movido y que no se haya empujado el teléfono.
- Un teléfono que **rueda** o **vibra** en vez de deslizarse tiene una aceleración menos constante.
- Un error de 1° en θ cambia g·sen θ cerca de 6 % a 15°: parte de la diferencia puede venir del ángulo.
- **No** escribas que el sensor «está calibrado» o que los resultados son «exactos». Las cifras son estimaciones.

### ¿Por qué no sale exacto?

- El roce reduce la aceleración (esa diferencia es justamente lo que se estima como μ).
- La rampa puede ceder o moverse, y el teléfono puede torcerse durante la bajada.
- El ángulo se mide con el mismo sensor que la aceleración.
- El navegador y el sistema operativo filtran las lecturas; cada equipo lo hace distinto.

## 9. Notas para el docente

- **Duración:** 20 a 30 minutos con 3 repeticiones por grupo.
- **Seguridad:** usen siempre un tope blando; un golpe fuerte contra una superficie dura puede dañar el teléfono y no aporta datos.
- **Rampa:** la meseta de aceleración constante debe durar al menos 0,5 s tras recortar 0,1 s en cada extremo. Con a ≈ 2 m/s², 0,7 s de meseta equivalen a unos 50 cm de recorrido: usen una rampa de 60 cm o más. Con inclinaciones menores o más roce se necesita una rampa más larga.
- **Umbrales:** los de la prueba (umbral de movimiento, meseta mínima, tolerancia de la meseta, rango de inclinación) están en `DEFAULT_MOTION_CONFIG` (`src/labs/motion/motionPhysics.ts`) y se exportan con cada prueba. Ajústalos con pruebas reales de su equipo.
- **Validación pendiente:** el laboratorio se probó con señales sintéticas. Antes de evaluar, hagan una bajada de prueba con el teléfono real que usarán y verifiquen que la aceleración sale menor que g·sen θ.
- **Privacidad:** los datos no salen del teléfono; no hay servidor ni cuentas.
