import { useEffect, useRef } from "react";
import { formatNumber } from "../../lib/format";
import type { AnglePoint } from "./useTiltLab";

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Inclinación vs. tiempo. Eje X en segundos (en vivo: segundos hasta "ahora";
 * prueba: desde el inicio de la ventana). Eje Y en grados con escala automática
 * de al menos 6° para que el ruido real sea visible sin exagerarlo.
 */
export function AngleChart({
  points,
  timeMode,
  referenceDeg = null,
  meanDeg = null,
  height = 200,
  ariaLabel,
}: {
  points: readonly AnglePoint[];
  timeMode: "relative-end" | "relative-start";
  referenceDeg?: number | null;
  meanDeg?: number | null;
  height?: number;
  ariaLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const draw = () => {
      const width = canvas.clientWidth || 320;
      const h = canvas.clientHeight || height;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(h * ratio);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, h);

      const grid = cssVar("--border-soft", "#e7e7ec");
      const muted = cssVar("--text-tertiary", "#8a8a93");
      const primary = cssVar("--text-primary", "#111113");
      const theta = cssVar("--axis-theta", "#8b4ff7");
      const warning = cssVar("--warning", "#b2501c");
      const pad = { top: 14, right: 12, bottom: 30, left: 56 };
      const plotW = Math.max(1, width - pad.left - pad.right);
      const plotH = Math.max(1, h - pad.top - pad.bottom);

      context.font = "11px system-ui, sans-serif";
      context.fillStyle = muted;

      if (points.length < 2) {
        context.textAlign = "center";
        context.font = "600 13px system-ui, sans-serif";
        context.fillText("Sin datos suficientes para graficar", width / 2, h / 2);
        return;
      }

      const values = points.map((point) => point.thetaDeg);
      const extra = [referenceDeg, meanDeg].filter((value): value is number => value !== null && Number.isFinite(value));
      let minY = Math.min(...values, ...extra);
      let maxY = Math.max(...values, ...extra);
      const span = Math.max(6, (maxY - minY) * 1.25);
      const center = (minY + maxY) / 2;
      minY = Math.max(0, center - span / 2);
      maxY = Math.min(90, minY + span);
      if (maxY - minY < span) minY = Math.max(0, maxY - span);

      const t0 = points[0].tMs;
      const t1 = points[points.length - 1].tMs;
      const tSpan = Math.max(t1 - t0, 1);
      const x = (tMs: number) => pad.left + ((tMs - t0) / tSpan) * plotW;
      const y = (deg: number) => pad.top + ((maxY - deg) / (maxY - minY)) * plotH;

      // Rejilla y etiquetas Y
      context.strokeStyle = grid;
      context.lineWidth = 1;
      context.textAlign = "right";
      for (let index = 0; index <= 4; index += 1) {
        const value = maxY - ((maxY - minY) * index) / 4;
        const yy = Math.round(y(value)) + 0.5;
        context.beginPath();
        context.moveTo(pad.left, yy);
        context.lineTo(width - pad.right, yy);
        context.stroke();
        context.fillText(`${formatNumber(value, span < 10 ? 1 : 0)}°`, pad.left - 6, yy + 4);
      }
      // Etiquetas X
      context.textAlign = "center";
      const seconds = tSpan / 1000;
      const steps = 4;
      for (let index = 0; index <= steps; index += 1) {
        const tMs = t0 + (tSpan * index) / steps;
        const label = timeMode === "relative-end"
          ? formatNumber((tMs - t1) / 1000, seconds < 4 ? 1 : 0)
          : formatNumber((tMs - t0) / 1000, seconds < 4 ? 1 : 0);
        context.fillText(label, x(tMs), h - 14);
      }
      context.fillText("tiempo (s)", pad.left + plotW / 2, h - 2);
      context.save();
      context.translate(10, pad.top + plotH / 2);
      context.rotate(-Math.PI / 2);
      context.fillText("θ (°)", 0, 0);
      context.restore();

      if (referenceDeg !== null && referenceDeg >= minY && referenceDeg <= maxY) {
        context.strokeStyle = warning;
        context.setLineDash([6, 5]);
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(pad.left, y(referenceDeg));
        context.lineTo(width - pad.right, y(referenceDeg));
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = warning;
        context.textAlign = "left";
        context.fillText("referencia", pad.left + 4, y(referenceDeg) - 5);
      }
      if (meanDeg !== null) {
        context.strokeStyle = primary;
        context.lineWidth = 1;
        context.setLineDash([2, 3]);
        context.beginPath();
        context.moveTo(pad.left, y(meanDeg));
        context.lineTo(width - pad.right, y(meanDeg));
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = primary;
        context.textAlign = "right";
        context.fillText("promedio", width - pad.right - 4, y(meanDeg) - 5);
      }

      // Serie: los huecos de más de 250 ms no se unen (no se inventan datos).
      context.strokeStyle = theta;
      context.lineWidth = 2;
      context.beginPath();
      let previous: AnglePoint | null = null;
      for (const point of points) {
        if (!previous || point.tMs - previous.tMs > 250) context.moveTo(x(point.tMs), y(point.thetaDeg));
        else context.lineTo(x(point.tMs), y(point.thetaDeg));
        previous = point;
      }
      context.stroke();
    };
    draw();
    const parent = canvas.parentElement;
    const observer = typeof ResizeObserver === "undefined" || !parent ? null : new ResizeObserver(draw);
    if (observer && parent) observer.observe(parent);
    return () => observer?.disconnect();
  }, [height, meanDeg, points, referenceDeg, timeMode]);

  return (
    <div className="chart-frame" style={{ height }}>
      <canvas ref={canvasRef} className="chart-canvas" role="img" aria-label={ariaLabel} />
    </div>
  );
}
