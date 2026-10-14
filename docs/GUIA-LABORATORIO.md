# Guía de laboratorio — ¿Qué tan inclinado está tu teléfono?

**LabMotion V2 · Universidad Mayor · INGT1037 · Grupo 1**
Aplicación: <https://labmotionv2.iroak.dev> (pestaña **Labs › Medición de inclinación**)

## 1. Objetivo

Medir la inclinación de una superficie con el acelerómetro de un smartphone y comparar el resultado con un transportador físico, calculando el error de la medición.

## 2. Pregunta e hipótesis

- **Pregunta:** ¿Podemos medir una inclinación con el celular y comprobarla con un transportador?
- **Hipótesis:** el ángulo que calcula LabMotion será cercano al ángulo fijado con el transportador físico.

## 3. Materiales

- Teléfono compatible: Android con Chrome o iPhone con Safari.
- Transportador físico.
- Soporte inclinable y firme (tabla, libro grueso o atril) y una superficie horizontal.
- Opcional: cinta adhesiva o un tope para que el teléfono no se deslice.

Anotar: modelo del teléfono, navegador, fecha y quién midió.

## 4. ¿Cómo funciona? (en simple)

El acelerómetro percibe la dirección de la gravedad. Cuando el teléfono está plano, casi toda la gravedad cae sobre el eje Z (perpendicular a la pantalla). Al inclinarlo, una parte pasa a los ejes X e Y. LabMotion compara esas partes y calcula el ángulo:

```text
θ = atan2(√(gx² + gy²), |gz|)
```

La pantalla del teléfono solo **muestra** lo que mide el sensor; la comparación independiente la da el **transportador físico**.

## 5. Procedimiento

### Preparación

1. Abrir la aplicación en el teléfono y entrar a **Labs › Medición de inclinación**.
2. Tocar **Comenzar experimento** y aceptar el permiso de movimiento si aparece.
3. Comprobar que el estado diga **Listo**. Si no, abrir **Diagnóstico**.

### Referencia de 0°

4. Poner el teléfono con la **pantalla hacia arriba** sobre la superficie horizontal.
5. Esperar a que el indicador marque **Estable** y la lectura esté cerca de 0°.
6. Tocar **Registrar medición**, elegir **0°** y **Medir cuando esté estable**. Soltar el teléfono y no tocarlo: la app descarta el instante del toque, espera la estabilidad y promedia 2 s.
7. Repetir hasta tener **3 pruebas** de 0°.

### Referencias de 30°, 45° y 60°

8. Ajustar el soporte al ángulo con el **transportador físico** (no con la pantalla del teléfono).
9. Apoyar el teléfono sobre el soporte con la pantalla hacia arriba, alineado con la pendiente.
10. Registrar la prueba con la referencia correspondiente y repetir 3 veces, retirando y volviendo a apoyar el teléfono entre pruebas.

Se puede dejar la sesión incompleta: los resultados indican cuántas pruebas hay de cada ángulo. Una prueba mal hecha se puede **repetir** o **eliminar** desde Resultados.

## 6. Registro de datos

La app completa esta tabla en **Resultados**; también se puede copiar con **Copiar resumen para el informe**.

| Referencia | P1 | P2 | P3 | Promedio | Error absoluto | Error % |
|---|---|---|---|---|---|---|
| 0° | | | | | | No aplica |
| 30° | | | | | | |
| 45° | | | | | | |
| 60° | | | | | | |

- Error absoluto = |promedio − referencia|.
- Error % = error absoluto / referencia × 100. Con 0° no aplica (no se puede dividir por cero).

Exportar **CSV de resultados**, **CSV de muestras** y **JSON** para anexarlos al informe.

## 7. Preguntas para el estudiante

1. ¿Qué lectura dio el teléfono plano? ¿Por qué no es exactamente 0,0°?
2. ¿En qué referencia fue mayor la diferencia? ¿Qué podría explicarlo?
3. ¿Las tres pruebas de un mismo ángulo dieron lo mismo? ¿Qué indica la dispersión?
4. Abre **Ciencia**: ¿cómo cambian gx y gz al pasar de 0° a 60°?
5. ¿Por qué la app pide que el teléfono esté quieto antes de medir?
6. ¿Se puede afirmar que el sensor está calibrado con estos datos? Justifica.

## 8. Interpretación

- Una diferencia de pocos grados es un resultado experimental válido si se documenta junto a sus causas probables: ruido, movimiento, soporte que cede, lectura del transportador, mesa no nivelada, desalineación del sensor con la carcasa, funda o cámara que levanta un borde, y el filtrado del sistema operativo.
- No afirmar «sensor calibrado», «precisión demostrada» ni «0 % de error»: el experimento compara el teléfono usado con el transportador usado, en esas condiciones.
- Conclusión sugerida (completar con los datos reales): «Para una referencia de 30°, LabMotion midió en promedio …°; la diferencia fue …°».

## 9. Notas para el docente

- La app funciona sin cuentas ni servidor; los datos quedan en el navegador del teléfono hasta que se exportan o se borran.
- El **modo simulación** sirve para mostrar la interfaz en un proyector sin sensores. Está rotulado «SIMULACIÓN — NO SON DATOS REALES» y no permite registrar pruebas.
- Si un teléfono no entrega aceleración lineal, la app usa una «estimación en reposo» y marca la prueba con advertencia.
