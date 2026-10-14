import { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * Traducción de Kloset toast.tsx: fondo casi negro, radio mínimo (3px),
 * flota sobre el contenido y desaparece solo. Store mínimo en módulo (sin
 * Context) + showToast exportado. Un toast a la vez, autodismiss 3200ms.
 */
interface ToastState {
  id: number;
  message: string;
}

let listeners: ((toast: ToastState) => void)[] = [];
let nextId = 0;

export function showToast(message: string) {
  const toast = { id: nextId++, message };
  listeners.forEach((listener) => listener(toast));
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const listener = (t: ToastState) => setToast(t);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  // Arriba, justo bajo el header: abajo competía con la barra de
  // navegación, el FAB y el teclado en pantalla. Tocar el toast lo cierra.
  return (
    <div
      className={clsx(
        "pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+64px)] z-[70] flex justify-center px-[18px] transition-[opacity,transform] duration-[var(--duration-base)] ease-[var(--ease-out)]",
        toast ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
      )}
      role="status"
      aria-live="polite"
    >
      {toast && (
        <button
          type="button"
          onClick={() => setToast(null)}
          className="pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-md bg-[#232325] px-4 py-3 text-left text-caption text-white shadow-floating"
        >
          {toast.message}
        </button>
      )}
    </div>
  );
}
