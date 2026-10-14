import { useEffect, useRef } from "react";

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: "release", listener: () => void): void;
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
};

/**
 * Mantiene la pantalla encendida mientras `active` sea true (hook de Fit-App).
 * Requiere HTTPS; si el navegador lo rechaza, la medición sigue sin wake lock.
 * Se vuelve a pedir al regresar a la pestaña, porque el sistema lo suelta al
 * ocultarla.
 */
export function useWakeLock(active: boolean): void {
  const wakeSentinel = useRef<WakeLockSentinelLike | null>(null);
  const wakeRequestPending = useRef(false);

  useEffect(() => {
    if (!active) {
      void wakeSentinel.current?.release().catch(() => undefined);
      wakeSentinel.current = null;
      return undefined;
    }
    let cancelled = false;
    const acquire = async () => {
      const wakeNavigator = navigator as WakeLockNavigator;
      if (!wakeNavigator.wakeLock || wakeSentinel.current || wakeRequestPending.current) return;
      wakeRequestPending.current = true;
      try {
        const sentinel = await wakeNavigator.wakeLock.request("screen");
        if (cancelled) {
          await sentinel.release();
          return;
        }
        wakeSentinel.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (wakeSentinel.current === sentinel) wakeSentinel.current = null;
        });
      } catch {
        // Sin permiso o no soportado: se continúa sin wake lock.
      } finally {
        wakeRequestPending.current = false;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !wakeSentinel.current) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void wakeSentinel.current?.release().catch(() => undefined);
      wakeSentinel.current = null;
    };
  }, [active]);
}
