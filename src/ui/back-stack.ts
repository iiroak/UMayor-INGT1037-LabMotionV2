import { useEffect, useRef, useState } from "react";

/**
 * Botón / gesto "atrás" del sistema para la UI de la app.
 *
 * La app no tiene rutas: hojas, modo foco, editor, pestañas… son estado de
 * React. Sin esto, "atrás" salía de la app en vez de cerrar lo que hay
 * abierto. Cada capa abierta (hoja, vista, pantalla secundaria) se registra
 * con `useBackLayer(abierta, cerrar)` y ocupa una entrada del historial;
 * "atrás" cierra la capa de más arriba.
 *
 * Las entradas del historial son marcadores anónimos: lo único que importa
 * es que haya tantas como capas abiertas. Los cambios se aplican al final
 * de la tarea (microtask), así que cerrar una hoja y abrir otra en el mismo
 * click no toca el historial, y cerrar varias capas a la vez hace un único
 * `history.go(-n)`.
 */

interface Layer {
  id: number;
  onBack: () => void;
}

interface BackState {
  session: string;
  depth: number;
}

const SESSION = Math.random().toString(36).slice(2);
const stack: Layer[] = [];
/** Entradas propias por encima de la base que hay ahora en el historial. */
let depth = 0;
/** Hay un `history.go()` propio en curso: su popstate no es del usuario. */
let awaitingPop = false;
let scheduled = false;
let nextId = 1;
let installed = false;

function readState(): BackState | null {
  const value = (window.history.state as { labBack?: BackState } | null)?.labBack;
  return value && typeof value.depth === "number" ? value : null;
}

function writeState(nextDepth: number): object {
  const current = window.history.state as Record<string, unknown> | null;
  return { ...(current ?? {}), labBack: { session: SESSION, depth: nextDepth } satisfies BackState };
}

/** Lleva el historial a tantas entradas como capas abiertas. */
function flush() {
  scheduled = false;
  if (awaitingPop) return; // se reintenta al llegar el popstate pendiente
  const wanted = stack.length;
  if (wanted > depth) {
    for (let next = depth + 1; next <= wanted; next += 1) {
      window.history.pushState({ labBack: { session: SESSION, depth: next } satisfies BackState }, "");
    }
    depth = wanted;
  } else if (wanted < depth) {
    awaitingPop = true;
    window.history.go(wanted - depth);
  }
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(flush);
}

function onPopState() {
  const state = readState();
  const landed = state?.session === SESSION ? state.depth : null;

  if (awaitingPop) {
    awaitingPop = false;
    depth = landed ?? 0;
    flush(); // por si se abrieron/cerraron capas mientras tanto
    return;
  }

  if (landed === null) {
    // Entrada de una carga anterior de la página (recarga): no hay nada
    // que cerrar en ella; se sigue hacia atrás para salir de verdad.
    while (stack.length) stack.pop()?.onBack();
    depth = 0;
    window.history.back();
    return;
  }

  if (landed < depth) {
    // El usuario retrocedió: se cierran las capas que quedaron fuera.
    const closed = stack.splice(Math.max(0, stack.length - (depth - landed))).reverse();
    depth = landed;
    for (const layer of closed) layer.onBack();
    schedule();
  } else if (landed > depth) {
    // "Adelante" hacia capas que ya se cerraron: se deshace.
    awaitingPop = true;
    window.history.go(depth - landed);
  }
}

function install() {
  if (installed) return;
  installed = true;
  // La entrada en la que arranca la app es la base (profundidad 0).
  window.history.replaceState(writeState(0), "");
  window.addEventListener("popstate", onPopState);
}

// Desde el arranque: así las entradas viejas de una recarga se saltan aunque
// todavía no se haya abierto ninguna capa.
if (typeof window !== "undefined") install();

function pushLayer(onBack: () => void): number {
  install();
  const id = nextId++;
  stack.push({ id, onBack });
  schedule();
  return id;
}

function releaseLayer(id: number) {
  const index = stack.findIndex((layer) => layer.id === id);
  if (index < 0) return; // ya la cerró el botón atrás
  stack.splice(index, 1);
  schedule();
}

/**
 * Mientras `active` sea true, "atrás" llama a `onBack` (que debe cerrar la
 * capa). Si tras `onBack` la capa sigue activa (p. ej. una acción async que
 * falló), se vuelve a registrar para que el siguiente "atrás" no salga de
 * la app.
 */
export function useBackLayer(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    const id = pushLayer(() => {
      setGeneration((value) => value + 1);
      onBackRef.current();
    });
    return () => releaseLayer(id);
  }, [active, generation]);
}
