# UMayor-INGT1037-LabMotionV2

**LabMotion V2** es el laboratorio web del Grupo 1 (Proyecto de Innovación Tecnológica, Universidad Mayor) para **medir con el acelerómetro de un smartphone**: la **inclinación** (comparada con un transportador físico) y, en dos laboratorios en piloto, el **movimiento rectilíneo uniforme (MRU)** y **uniformemente acelerado (MRUA)**, usando solo el teléfono.

- Aplicación: <https://labmotionv2.iroak.dev>
- Versión anterior (monitor de sensores): <https://labmotion.iroak.dev> · [repositorio v1](https://github.com/iiroak/UMayor-INGT1037-LabMotion)
- Guías de laboratorio para estudiantes y docentes: [Inclinación](docs/GUIA-LABORATORIO.md) · [MRU](docs/GUIA-MRU.md) · [MRUA](docs/GUIA-MRUA.md)

La interfaz reutiliza el sistema visual de Fit-App (tokens, tarjetas, barra inferior, hojas inferiores, control segmentado) y conserva todas las funciones de LabMotion v1: **Magnitudes, Capturar, Gráficos y Diagnóstico**. La pestaña nueva **Labs** contiene el experimento «Medición de inclinación».

No hay backend, cuentas ni envío de datos: todo ocurre en el navegador del teléfono.

## Qué hace el laboratorio

| Vista | Contenido |
|---|---|
| **Introducción** | Pregunta, hipótesis, materiales, estado de sensores («Listo», «Solicitar permiso», «Sin datos», «No compatible», «Se perdió la señal»). El permiso se pide solo al tocar «Comenzar experimento». |
| **Demostración** | Transportador digital 0–90° (marcas cada 10° y 5°) o regla ampliada de 1°, cifra grande en grados, explicación según el estado, indicador «Estable / En movimiento / Señal insuficiente», «Congelar lectura», «Registrar medición», experimento guiado 4 × 3. |
| **Ciencia** | Cadena sensor → a_total y a_lineal → g → \|g\| → θ → transportador, con «En simple» y «Ver datos y fórmula» (sustitución con los números de la lectura actual o congelada), origen de cada dato (medición entregada / magnitud derivada), código fuente real, estabilidad y gráfico θ vs. tiempo. |
| **Resultados** | Tabla por referencia (P1–P3, promedio, error), comparación referencia vs. medida, tabla de todas las pruebas, gráfico de la prueba seleccionada, conclusión generada solo con los datos presentes, «¿Por qué no coincide exactamente?», exportación CSV/JSON y resumen para el informe. |

Las tres vistas leen el **mismo estado**: cambiar de vista o de pestaña no reinicia los sensores ni pierde mediciones. Las pruebas se guardan en `localStorage` del navegador para sobrevivir a una recarga.

### Modo simulación

Sirve para ensayar la exposición en un computador. Muestra un rótulo fijo **«SIMULACIÓN — NO SON DATOS REALES»**, usa un deslizador 0–90° y **no permite congelar, registrar ni exportar**: las pruebas solo aceptan muestras reales del sensor.

## Laboratorios de movimiento: MRU y MRUA

Los dos usan **solo el teléfono**, apoyado con la pantalla hacia arriba sobre una superficie. Tienen las mismas vistas que Inclinación (Introducción, Demostración, Ciencia, Resultados, hoja de registro) y una simulación que pasa por el mismo cálculo. Aparecen como **«Piloto»** en la pantalla Labs hasta validarlos con teléfonos reales.

| Laboratorio | Montaje | Qué calcula |
|---|---|---|
| **MRU** | Se empuja el teléfono sobre una superficie lisa o un carrito, se suelta y se frena con la mano. | Velocidad de crucero, variación de la velocidad, aceleración en el crucero, ajuste lineal de x(t) con su R², distancia total y deriva corregida. |
| **MRUA** | El teléfono baja por una rampa de 3° a 60°. | Inclinación θ medida por el propio teléfono, aceleración media, **g·sen θ**, coeficiente de roce μ = tan θ − a/(g·cos θ), ajuste lineal de v(t) y cuadrático de x(t). |

```text
a_mov(t) = lectura(t) − promedio(lecturas en reposo)   (a lo largo del eje de movimiento)
v = ∫a·dt     x = ∫v·dt     (regla del trapecio, sobre los tiempos reales de cada muestra)
MRU:  v_corregida(t) = v(t) − v_final·(t − t₀)/(t_final − t₀)     (el teléfono termina quieto)
MRUA: a_ideal = g·sen θ     μ = tan θ − a/(g·cos θ)
```

- **Fuente de la aceleración:** `accelerationIncludingGravity` menos la línea base de reposo. Solo si el navegador no la entrega se usa `acceleration` (filtrada por el sistema) y la prueba queda con aviso. El MRUA exige la lectura con gravedad porque mide θ con ella.
- **Eje de movimiento:** autovector mayor de la matriz de segundo momento de la aceleración en el plano de la pantalla. No depende de cómo se apoye el teléfono ni del signo de los ejes del navegador; el sentido del arranque es el positivo. En MRUA se comprueba además que coincida con la línea de máxima pendiente.
- **MRU y el final del crucero:** en crucero la aceleración es ≈ 0, igual que en reposo, así que el crucero se delimita entre el lóbulo positivo del empujón y el negativo del frenado. Sin frenado la prueba se rechaza.
- **Invalidan una prueba:** un hueco de más de 100 ms entre muestras (no se acota en silencio), menos de 15 Hz, un giro de más de 90 °/s, una superficie inclinada en MRU o fuera de 3°–60° en MRUA, y una deriva mayor al 60 % de la velocidad máxima (MRU).
- **Umbrales:** `DEFAULT_MOTION_CONFIG` (`src/labs/motion/motionPhysics.ts`), versionados con `MOTION_CALC_VERSION` y exportados con cada prueba. Cumplirlos indica que la lectura es coherente, no que sea precisa.
- **Guardado:** cada laboratorio persiste hasta 12 pruebas en `localStorage` (`labmotion.v2.mru.trials`, `labmotion.v2.mrua.trials`) con la serie a(t), v(t), x(t) a ≤ 50 Hz, no con las muestras crudas. Solo se suscriben al sensor mientras están abiertos, y cerrar el laboratorio cancela la captura en curso.

## Modelo físico (Inclinación)

Sensor usado: **acelerómetro** (`DeviceMotionEvent`). El giroscopio no entra en la fórmula; solo ayuda a detectar movimiento.

```text
g  = a_total − a_lineal                  (modo «diferencia», ambas lecturas completas)
g ≈ a_total                              (modo «reposo», si el navegador no entrega a_lineal)
|g| = √(gx² + gy² + gz²)
θ  = atan2(√(gx² + gy²), |gz|) · 180/π   (0° pantalla horizontal, 90° vertical)
```

- θ es la inclinación de la pantalla respecto a la horizontal, **sin signo** y entre 0° y 90°: no indica hacia qué borde se inclinó.
- Si falta el vector o \|g\| sale de 7–12,5 m/s², no hay lectura: **nunca se muestra 0° por defecto**.
- La función de v1 `inclinacionRespectoVertical` (`acos(gz/|g|)`, 0–180°) se conserva en Magnitudes con su nombre corregido («Ángulo entre el eje Z y la gravedad»), porque depende del signo de gz según el navegador.
- 9,81 m/s² se muestra solo como referencia explicativa; que \|g\| se parezca no valida el sensor, porque g sale de dos lecturas del mismo sistema.

### Estabilidad y captura de una prueba

Una ventana móvil de 1 s se considera **estable** si tiene al menos 8 lecturas, cubre el 60 % de la ventana, σ(θ) ≤ 0,5°, rango ≤ 2°, \|a_lineal\| media ≤ 0,3 m/s² y \|ω\| ≤ 6 °/s (si existen). Al tocar «Medir cuando esté estable»:

1. se descartan 1,2 s para que el toque no entre al promedio;
2. se espera a que la ventana esté estable (máx. 25 s);
3. se promedian 2 s estables; **cualquier movimiento reinicia la ventana**;
4. se guarda la prueba con media, σ, rango, error absoluto, error porcentual (**«No aplica» con referencia 0°**), número de muestras, duración, frecuencia efectiva (tiempos reales `MotionSample.tMs`), modo de gravedad, advertencias y las muestras originales.

Un cambio de orientación de pantalla o la pérdida de señal cancela la prueba. Los umbrales están en `DEFAULT_TILT_CONFIG` (`src/labs/tilt/tiltPhysics.ts`), se exportan con cada prueba y deben ajustarse con pruebas reales: cumplirlos indica que la lectura estaba quieta, no que sea precisa.

**Filtros:** la aguja usa un suavizado exponencial **solo visual** (τ = 0,12 s; desactivado con «reducir movimiento»). La cifra grande, la vista Ciencia y las pruebas usan cada muestra sin filtrar.

## Arquitectura

```text
src/
  App.tsx                 pestañas, cabecera, estado global
  hooks/useSensors.ts     ÚNICA suscripción a devicemotion/deviceorientation (v1) + subscribe()
  hooks/useRecording.ts   captura libre de la pestaña Capturar (v1)
  lib/                    sensors, fisica, kinematics, diagnostics, export (v1) y formato es-CL
  ui/                     componentes de Fit-App (AppShell, BottomNavigation, BottomSheet, …)
  screens/                Labs, Magnitudes, Capturar, Gráficos, Diagnóstico
  components/             StripChart (v1) y TimeSeriesChart (gráficos de los labs de movimiento)
  labs/registry.ts        los tres laboratorios de la pantalla Labs
  labs/motion/            MRU y MRUA (comparten código; los textos viven en motionContent.ts)
    motionPhysics.ts      línea base, eje, integración, cero de velocidad, ajustes (puras)
    motionCapture.ts      máquina de captura: reposo → preparado → grabando (pura)
    motionSession.ts      pruebas, resumen, conclusión, persistencia local
    motionExport.ts       CSV de resultados, CSV de series, JSON de sesión
    motionSynthetic.ts    señales sintéticas para pruebas y simulación (nunca se presentan como datos)
    useMotionLab.ts       estado React por laboratorio (se suscribe solo con el lab abierto)
    MotionLab/Intro/Demo/Science/Results/MeasureSheet/AnalysisView.tsx
  labs/tilt/
    tiltPhysics.ts        lectura, θ, estadísticas, errores, estabilidad (funciones puras)
    tiltCapture.ts        ventana móvil y máquina de captura de una prueba (puras)
    tiltSession.ts        pruebas, resúmenes, conclusión, persistencia local
    tiltExport.ts         CSV de resultados, CSV de muestras, JSON de sesión
    useTiltLab.ts         estado React del laboratorio (se suscribe a useSensors)
    TiltLab/Intro/Demo/Science/Results/MeasureSheet/Protractor/Chart.tsx
```

Stack: React 19, TypeScript, Vite 8, Tailwind CSS 4 (tokens de Fit-App), Vitest. Sin otras dependencias de runtime aparte de `clsx`.

## Desarrollo

Requiere Node.js 22 y pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:4174
pnpm typecheck
pnpm test
pnpm build
```

Los sensores del teléfono exigen **HTTPS**: para probar en un móvil usa la URL publicada o un túnel HTTPS propio. En `localhost` del computador funciona la simulación.

## Verificación realizada

- `pnpm typecheck`, `pnpm test` (171 pruebas) y `pnpm build`: sin errores. El `Dockerfile` repite typecheck + tests antes de construir.
- Las pruebas unitarias (incluidas las de MRU y MRUA: ajustes, invariancia al giro del teléfono y al signo del navegador, huecos de muestreo, deriva, máquina de captura, exportación y UI) usan **vectores y señales sintéticos** (0°, 30°, 45°, 60°, 90° con g = 9,81) para comprobar solo las matemáticas: componentes ausentes, amplitudes inválidas, referencia 0°, estabilidad, reinicio por movimiento, señal perdida, numeración y reemplazo de pruebas, exportación y persistencia. También hay pruebas básicas de UI renderizadas en servidor.
- Recorrido en Chrome de escritorio (390 × 844) inyectando eventos `devicemotion` sintéticos: abrir el laboratorio, medir 0°, 30° y 45°, ver resultados, Ciencia, simulación y las pestañas heredadas, sin errores de consola. **Esto no es una prueba con un teléfono real.**
- Recorrido de MRU y MRUA en Chrome (390 × 844) con eventos `devicemotion` sintéticos en tiempo real: abrir cada laboratorio, preparar, soltar/empujar, ver la prueba, Resultados y Ciencia, recargar y comprobar que la prueba persiste, y cancelar sin que se guarde nada. Una MRUA sintética con a = 2 m/s² sobre 15° dio θ = 15,0° y a = 2,00 m/s²; una MRU sintética con empujón de 0,8 m/s dio 0,78 m/s. **Tampoco es una prueba con un teléfono real.**
- **Pendiente del grupo:** probar en teléfonos reales (Android/Chrome e iPhone/Safari), sobre un soporte con transportador, y anotar modelo, navegador y resultados. Ningún equipo físico se ha declarado comprobado.

## Producción (Coolify)

- `Dockerfile`: build con `node:22.22-alpine` (typecheck, tests, build) y runtime `nginx:1.30.5-alpine`.
- El contenedor escucha en el puerto **80**; healthcheck en `GET /healthz`.
- `nginx.conf`: fallback SPA, gzip, caché inmutable de `/assets`, CSP de mismo origen y `Permissions-Policy` que habilita acelerómetro y giroscopio solo para el sitio.
- En Coolify: build pack *Dockerfile*, puerto expuesto `80`, mapeo de host `52101:80`, rama `main` con auto-deploy. Un túnel de Cloudflare publica `labmotionv2.iroak.dev` hacia ese puerto del servidor Coolify (sitio público, sin autenticación: no guarda datos en el servidor).

## Exportación

| Archivo | Contenido |
|---|---|
| `labmotion-inclinacion-resultados-*.csv` | Una fila por prueba: referencia, intento, media, σ, mín/máx, error absoluto, error % (`no_aplica` con 0°), muestras, duración, frecuencia, modo, advertencias, versión. |
| `labmotion-inclinacion-muestras-*.csv` | Cada muestra original con a_total, a_lineal, g, \|g\|, θ y giro. |
| `labmotion-inclinacion-*.json` | Sesión completa (`labmotion-tilt-session-v1`): modelo, configuración, diagnóstico, resumen, pruebas y muestras. |
| `labmotion-mru-resultados-*.csv`, `labmotion-mrua-resultados-*.csv` | Una fila por prueba y una sola cabecera (sin líneas `#`, punto decimal): resultados del ajuste, distancia con cinta y su error, calidad, frecuencia, fuente y avisos. |
| `labmotion-mru-series-*.csv`, `labmotion-mrua-series-*.csv` | La serie a(t), v(t), x(t) de cada prueba. |
| `labmotion-mru-*.json`, `labmotion-mrua-*.json` | Sesión (`labmotion-mru-session-v1`, `labmotion-mrua-session-v1`): versión del cálculo, umbrales y pruebas. `simulated: false`. |

La pestaña Capturar conserva el CSV/JSON de v1 (`labmotion-capture-v1`, mismas columnas).

## Estado

| Estado | Elementos |
|---|---|
| Implementado y probado con datos sintéticos | Cálculo de θ, estabilidad, captura de pruebas, errores, resúmenes, conclusión, exportación, persistencia, UI del laboratorio. MRU y MRUA: línea base, eje de movimiento (invariante al giro del teléfono y al signo del navegador), integración, cero de velocidad, ajustes, máquina de captura, exportación y UI. |
| Implementado sin validar en teléfono real | Lectura de sensores en Android/iOS, umbrales de estabilidad, bloqueo de pantalla (Wake Lock), comportamiento al girar la pantalla. **Todo MRU y MRUA**: los umbrales de `DEFAULT_MOTION_CONFIG`, el ruido real del sensor, cuánto dura un crucero útil y qué tan bien se recupera g·sen θ. |
| Pendiente | Calibración relativa («poner a cero»), pitch/roll con signo, otros experimentos (giro acumulado, péndulo). |

### Limitaciones conocidas

- La inclinación no tiene dirección; el procedimiento usa pantalla hacia arriba.
- MRU y MRUA integran dos veces un acelerómetro: la posición es una **estimación** que deriva con el tiempo. Sirven para tramos de 1 a 3 s. El MRU necesita un frenado marcado para saber dónde termina el crucero, y el MRUA un tramo de aceleración constante de al menos 0,5 s.
- Algunos navegadores no entregan `acceleration` (aceleración lineal): se usa la estimación en reposo y la prueba queda con advertencia.
- iOS exige permiso explícito; si se rechaza, hay que habilitarlo en Ajustes › Safari.
- El sistema operativo filtra y estima las lecturas; cada equipo puede comportarse distinto.

## Capturas para el informe

Genera las capturas desde **una sesión real** en el teléfono: abre <https://labmotionv2.iroak.dev>, entra a Labs › Medición de inclinación, toca «Comenzar experimento», registra las pruebas con el transportador y usa la captura de pantalla del sistema en Demostración, Ciencia (con «Ver datos y fórmula» abierto) y Resultados. No uses el modo simulación para capturas de resultados.
