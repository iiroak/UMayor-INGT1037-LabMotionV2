/**
 * El documento de esta app NUNCA debe scrollear: el scroll vive dentro del
 * <main> del AppShell y de las capas fijas (modo foco, hojas).
 *
 * Bug que corrige: en Chrome Android (teclado en modo `resizes-visual`, el
 * de por defecto) al enfocar un input cerca del final de la lista el
 * navegador desplaza el documento entero el alto del teclado para dejarlo
 * a la vista. Al cerrar el teclado ese desplazamiento a veces no se
 * deshace: la cabecera queda fuera de la pantalla, abajo aparece una franja
 * vacía del alto del teclado y, como el gesto de scroll lo consume el
 * <main>, no hay forma de devolverlo salvo recargando.
 *
 * Mientras se escribe se deja actuar al navegador (en iOS ese desplazamiento
 * es lo que mantiene el input sobre el teclado); en cuanto el teclado se
 * cierra o el foco sale de los campos, el documento vuelve a (0, 0).
 */

function isEditable(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (!(element instanceof HTMLInputElement)) return false;
  return !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color", "image"].includes(element.type);
}

function resetDocumentScroll() {
  if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  // El contenedor raíz es `overflow-hidden`, pero "scroll into view" también
  // puede desplazar contenedores ocultos.
  const shell = document.getElementById("app-scroll-area")?.parentElement;
  if (shell && shell.scrollTop !== 0) shell.scrollTop = 0;
}

export function installViewportGuard() {
  const viewport = window.visualViewport;
  let lastHeight = viewport?.height ?? window.innerHeight;
  let timer = 0;
  // setTimeout (no rAF): se ejecuta después del ajuste de scroll del propio
  // navegador y también si la pestaña no está pintando.
  const resetSoon = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(resetDocumentScroll, 30);
  };

  // Teclado cerrado (el viewport visible crece). En Android el input puede
  // seguir enfocado tras cerrar el teclado con "atrás", así que no basta
  // con escuchar el blur. Se ignora el pinch-zoom (scale > 1).
  viewport?.addEventListener("resize", () => {
    const grew = viewport.height - lastHeight > 80;
    lastHeight = viewport.height;
    if (grew && viewport.scale <= 1.01) resetSoon();
  });

  // El foco sale de los campos (p. ej. tocar ✓ tras escribir los kg). El
  // nuevo activeElement ya está asignado cuando corre el timeout.
  document.addEventListener("focusout", () => {
    window.setTimeout(() => {
      if (!isEditable(document.activeElement)) resetSoon();
    }, 0);
  });

  // Cualquier desplazamiento del documento sin un campo enfocado es residual.
  window.addEventListener("scroll", () => {
    if (!isEditable(document.activeElement)) resetSoon();
  }, { passive: true });

  // Volver a la app (cambio de pestaña/app con el teclado abierto).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !isEditable(document.activeElement)) resetSoon();
  });
}
