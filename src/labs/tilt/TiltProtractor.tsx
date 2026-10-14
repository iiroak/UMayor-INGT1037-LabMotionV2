import { useEffect, useLayoutEffect, useRef } from "react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { formatDeg } from "../../lib/format";

/**
 * Suavizado SOLO visual de la aguja: filtro exponencial con constante de
 * tiempo NEEDLE_TAU_MS sobre el mismo valor que se muestra en números. No
 * modifica las muestras ni los resultados. Con `prefers-reduced-motion` la
 * aguja salta directamente al valor, sin animación.
 *
 * Los atributos que dependen del ángulo NO van en el JSX: React los volvería a
 * escribir en cada render (~12 por segundo) y pelearía con la animación.
 */
export const NEEDLE_TAU_MS = 120;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function useSmoothedAngle(target: number | null, apply: (angle: number) => void) {
  const reducedMotion = usePrefersReducedMotion();
  const currentRef = useRef<number | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useIsomorphicLayoutEffect(() => {
    if (target === null) return undefined;
    if (reducedMotion || currentRef.current === null) {
      currentRef.current = target;
      applyRef.current(target);
      return undefined;
    }
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const current = currentRef.current ?? target;
      const dt = Math.max(0, now - last);
      last = now;
      const next = current + (target - current) * (1 - Math.exp(-dt / NEEDLE_TAU_MS));
      const done = Math.abs(target - next) < 0.01;
      currentRef.current = done ? target : next;
      applyRef.current(currentRef.current);
      if (!done) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reducedMotion]);
}

// Geometría del transportador (cuarto de círculo 0–90°).
const OX = 30;
const OY = 270;
const R = 234;
/** Las cifras van FUERA del arco: la aguja nunca las tapa. */
const LABEL_R = R + 17;

function polar(radius: number, angleDeg: number): [number, number] {
  const radians = (angleDeg * Math.PI) / 180;
  return [OX + radius * Math.cos(radians), OY - radius * Math.sin(radians)];
}

function sectorPath(radius: number, angleDeg: number): string {
  const clamped = Math.max(0, Math.min(90, angleDeg));
  const [x, y] = polar(radius, clamped);
  return `M ${OX} ${OY} L ${OX + radius} ${OY} A ${radius} ${radius} 0 0 0 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

const TICKS = Array.from({ length: 19 }, (_, index) => index * 5);

export function TiltProtractor({
  angleDeg,
  referenceDeg = null,
  dimmed = false,
}: {
  /** Ángulo a representar; null = sin medición (no se dibuja un 0° falso). */
  angleDeg: number | null;
  /** Ángulo del transportador físico ingresado por el usuario. */
  referenceDeg?: number | null;
  dimmed?: boolean;
}) {
  const needleRef = useRef<SVGGElement>(null);
  const sectorRef = useRef<SVGPathElement>(null);
  const thetaLabelRef = useRef<SVGTextElement>(null);

  useSmoothedAngle(angleDeg, (angle) => {
    const clamped = Math.max(0, Math.min(90, angle));
    needleRef.current?.setAttribute("transform", `rotate(${(-clamped).toFixed(3)} ${OX} ${OY})`);
    sectorRef.current?.setAttribute("d", sectorPath(74, clamped));
    if (thetaLabelRef.current) {
      const [x, y] = polar(98, clamped / 2);
      thetaLabelRef.current.setAttribute("x", x.toFixed(1));
      thetaLabelRef.current.setAttribute("y", (y + 6).toFixed(1));
    }
  });

  const hasValue = angleDeg !== null;
  const label = hasValue ? `Transportador digital marcando ${formatDeg(angleDeg)}` : "Transportador digital sin medición";
  const showReference = referenceDeg !== null && referenceDeg >= 0 && referenceDeg <= 90;

  return (
    <svg viewBox="0 0 310 292" className="mx-auto block h-auto w-full max-w-[420px] select-none" role="img" aria-label={label}>
      <path d={sectorPath(R, 90)} fill="var(--surface-soft)" stroke="var(--border-soft)" strokeWidth="1.5" />
      {TICKS.map((tick) => {
        const major = tick % 10 === 0;
        const [x1, y1] = polar(R, tick);
        const [x2, y2] = polar(R - (major ? 22 : 11), tick);
        return (
          <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? "var(--text-secondary)" : "var(--text-tertiary)"} strokeWidth={major ? 2.4 : 1.4} strokeLinecap="round" />
        );
      })}
      {TICKS.filter((tick) => tick % 10 === 0).map((tick) => {
        const [x, y] = polar(LABEL_R, tick);
        return (
          <text key={tick} x={x + (tick === 0 ? 4 : 0)} y={y + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--text-secondary)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {tick === 0 || tick === 90 ? `${tick}°` : tick}
          </text>
        );
      })}
      {showReference && (() => {
        const [x, y] = polar(R, referenceDeg);
        const [lx, ly] = polar(R - 40, referenceDeg);
        return (
          <g data-testid="reference-line">
            <line x1={OX} y1={OY} x2={x} y2={y} stroke="var(--warning)" strokeWidth="2" strokeDasharray="6 5" />
            <text x={lx} y={ly - 7} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--warning)">ref</text>
          </g>
        );
      })()}
      <line x1={OX - 22} y1={OY} x2={OX + R} y2={OY} stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
      <text x={OX + R - 4} y={OY + 17} textAnchor="end" fontSize="11" fill="var(--text-tertiary)">superficie horizontal</text>

      {/* Siempre montados (visibility) para que la animación no se reinicie. */}
      <g visibility={hasValue ? "visible" : "hidden"}>
        <path ref={sectorRef} d={sectorPath(74, 0)} fill="color-mix(in srgb, var(--axis-theta) 16%, transparent)" stroke="var(--axis-theta)" strokeWidth="1.5" />
        <text ref={thetaLabelRef} x={OX + 98} y={OY + 6} textAnchor="middle" fontSize="16" fontStyle="italic" fontWeight="700" fill="var(--axis-theta)">θ</text>
        {/* Aguja = superficie inclinada con el teléfono apoyado (esquema, no fuente de medición). */}
        <g ref={needleRef} opacity={dimmed ? 0.55 : 1}>
          <line x1={OX} y1={OY} x2={OX + R - 4} y2={OY} stroke="var(--fab)" strokeWidth="5" strokeLinecap="round" />
          <rect x={OX + 88} y={OY - 19} width="90" height="16" rx="4.5" fill="var(--fab)" />
          <rect x={OX + 94} y={OY - 16} width="78" height="10" rx="2.5" fill="#3d3d42" />
          <circle cx={OX + R - 4} cy={OY} r="5" fill="var(--fab)" />
        </g>
      </g>
      {!hasValue && (
        <text x={OX + 116} y={OY - 92} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text-tertiary)">Sin medición</text>
      )}
      <circle cx={OX} cy={OY} r="8" fill="var(--fab)" />
      <circle cx={OX} cy={OY} r="3" fill="var(--surface)" />
    </svg>
  );
}

// Regla angular ampliada: misma lectura, escala de 1° alrededor del valor.
const RULER_W = 320;
const RULER_PX_PER_DEG = 13;
const RULER_TICKS = Array.from({ length: 111 }, (_, index) => index - 10);

export function TiltRuler({ angleDeg, referenceDeg = null }: { angleDeg: number | null; referenceDeg?: number | null }) {
  const scaleRef = useRef<SVGGElement>(null);
  useSmoothedAngle(angleDeg, (angle) => {
    scaleRef.current?.setAttribute("transform", `translate(${(RULER_W / 2 - angle * RULER_PX_PER_DEG).toFixed(2)} 0)`);
  });
  const hasValue = angleDeg !== null;
  return (
    <svg viewBox={`0 0 ${RULER_W} 132`} className="mx-auto block h-auto w-full max-w-[420px] select-none" role="img" aria-label={hasValue ? `Regla angular ampliada marcando ${formatDeg(angleDeg)}` : "Regla angular sin medición"}>
      <defs>
        <linearGradient id="ruler-fade" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--surface)" stopOpacity="1" />
          <stop offset="0.16" stopColor="var(--surface)" stopOpacity="0" />
          <stop offset="0.84" stopColor="var(--surface)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--surface)" stopOpacity="1" />
        </linearGradient>
        <clipPath id="ruler-clip"><rect x="0" y="0" width={RULER_W} height="132" /></clipPath>
      </defs>
      <rect x="0" y="18" width={RULER_W} height="96" rx="14" fill="var(--surface-soft)" />
      <g clipPath="url(#ruler-clip)">
        <g ref={scaleRef} visibility={hasValue ? "visible" : "hidden"}>
          {RULER_TICKS.map((tick) => {
            const x = tick * RULER_PX_PER_DEG;
            const outside = tick < 0 || tick > 90;
            const major = tick % 5 === 0;
            return (
              <g key={tick} opacity={outside ? 0.25 : 1}>
                <line x1={x} y1="18" x2={x} y2={major ? 52 : 36} stroke={major ? "var(--text-secondary)" : "var(--text-tertiary)"} strokeWidth={major ? 2 : 1.2} />
                {major && (
                  <text x={x} y="74" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--text-secondary)" style={{ fontVariantNumeric: "tabular-nums" }}>{tick}°</text>
                )}
              </g>
            );
          })}
          {referenceDeg !== null && (
            <g>
              <line x1={referenceDeg * RULER_PX_PER_DEG} y1="80" x2={referenceDeg * RULER_PX_PER_DEG} y2="112" stroke="var(--warning)" strokeWidth="3" />
              <text x={referenceDeg * RULER_PX_PER_DEG} y="127" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--warning)">ref</text>
            </g>
          )}
        </g>
      </g>
      <rect x="0" y="18" width={RULER_W} height="96" rx="14" fill="url(#ruler-fade)" />
      {hasValue ? (
        <g>
          <path d={`M ${RULER_W / 2 - 9} 6 L ${RULER_W / 2 + 9} 6 L ${RULER_W / 2} 20 Z`} fill="var(--axis-theta)" />
          <line x1={RULER_W / 2} y1="18" x2={RULER_W / 2} y2="56" stroke="var(--axis-theta)" strokeWidth="3" />
          <path d={`M ${RULER_W / 2 - 9} 114 L ${RULER_W / 2 + 9} 114 L ${RULER_W / 2} 100 Z`} fill="var(--axis-theta)" />
        </g>
      ) : (
        <text x={RULER_W / 2} y="72" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--text-tertiary)">Sin medición</text>
      )}
    </svg>
  );
}
