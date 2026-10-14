import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { BottomSheet } from "./bottom-sheet";

/**
 * Confirmación con la UI de la app (hoja inferior) en vez del
 * `window.confirm` del navegador. Mismo patrón que showToast: store en
 * módulo + <ConfirmHost/> montado una vez. Uso:
 *
 *   if (!(await confirmAction({ title: "¿Eliminar…?", confirmLabel: "Eliminar", destructive: true }))) return;
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let listener: ((request: ConfirmRequest) => void) | null = null;

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    // Sin host montado no hay forma de preguntar: no se ejecuta la acción.
    if (!listener) {
      resolve(false);
      return;
    }
    listener({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // Se conserva el contenido durante la animación de cierre.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    listener = (next) => {
      setRequest((current) => {
        current?.resolve(false);
        return next;
      });
      setOpen(true);
    };
    return () => {
      listener = null;
    };
  }, []);

  const answer = useCallback((value: boolean) => {
    setRequest((current) => {
      current?.resolve(value);
      return current ? { ...current, resolve: () => undefined } : null;
    });
    setOpen(false);
  }, []);

  const cancel = useCallback(() => answer(false), [answer]);

  return (
    <div className="relative z-[60]">
      <BottomSheet open={open} onClose={cancel}>
        {request && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5 text-center">
              <h2 className="text-title font-bold text-balance text-text-primary">{request.title}</h2>
              {request.message && <p className="text-body text-balance text-text-secondary">{request.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => answer(true)}
                className={clsx(
                  "h-12 w-full rounded-full text-body-medium font-semibold active:opacity-80",
                  request.destructive ? "bg-danger text-white" : "bg-fab text-fab-content",
                )}
              >
                {request.confirmLabel ?? "Aceptar"}
              </button>
              <button
                type="button"
                onClick={cancel}
                className="h-12 w-full rounded-full bg-surface-soft text-body-medium font-semibold text-text-primary active:opacity-80"
              >
                {request.cancelLabel ?? "Cancelar"}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
