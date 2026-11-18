import { useEffect, useRef } from "react";
import { formatNumber } from "../lib/format";

export type ChartPoint = { x: number; y: number };

export type ChartSeries = {
  label: string;
  color: string;
  points: readonly ChartPoint[];
  dashed?: boolean;
  width?: number;
  /** Los huecos de más de este valor en x no se unen (no se inventan datos). */
  maxGap?: number;
};

export type ChartLine = { y: number; label: string; color: string; dashed?: boolean };
export type ChartBand = { from: number; to: number; label?: string };

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function niceStep(span: number, ticks: number): number {
  const raw = span / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

/**
 * Gráfico de una o más series y(x) con eje x en segundos. Dibuja bandas verticales
 * (por ejemplo, el tramo que se ajusta), líneas horizontales de referencia y una
 * línea en y = 0. La escala vertical se ajusta a los datos.
 */
export function TimeSeriesChart({
  series,
  bands = [],
  lines = [],
  xLabel = "tiempo (s)",
  yLabel,
  height = 190,
  ariaLabel,
  yDigits,
}: {
  series: readonly ChartSeries[];
  bands?: readonly ChartBand[];
  lines?: readonly ChartLine[];
  xLabel?: string;
  yLabel: string;
  height?: number;
  ariaLabel: string;
  yDigits?: number;
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
      const accent = cssVar("--accent", "#387ff0");
      const pad = { top: 12, right: 12, bottom: 30, left: 52 };
      const plotW = Math.max(1, width - pad.left - pad.right);
      const plotH = Math.max(1, h - pad.top - pad.bottom);
      context.font = "11px system-ui, sans-serif";
      context.fillStyle = muted;
      const all = series.flatMap((item) => item.points);
      if (all.length < 2) {
        context.textAlign = "center";
        context.font = "600 13px system-ui, sans-serif";
        context.fillText("Sin datos suficientes para graficar", width / 2, h / 2);
        return;
      }
      const xs = all.map((point) => point.x);
      const ys = [...all.map((point) => point.y), ...lines.map((line) => line.y)];
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      let minY = Math.min(...ys, 0);
      let maxY = Math.max(...ys, 0);
      if (maxY - minY < 1e-6) maxY = minY + 1;
      const margin = (maxY - minY) * 0.08;
      minY -= minY < 0 ? margin : 0;
      maxY += margin;
      const xSpan = Math.max(maxX - minX, 1e-6);
      const x = (value: number) => pad.left + ((value - minX) / xSpan) * plotW;
      const y = (value: number) => pad.top + ((maxY - value) / (maxY - minY)) * plotH;

      for (const band of bands) {
        const from = Math.max(minX, Math.min(band.from, band.to));
        const to = Math.min(maxX, Math.max(band.from, band.to));
        if (to <= from) continue;
        context.globalAlpha = 0.12;
        context.fillStyle = accent;
        context.fillRect(x(from), pad.top, x(to) - x(from), plotH);
        context.globalAlpha = 1;
        if (band.label) {
          context.fillStyle = muted;
          context.textAlign = "left";
          context.fillText(band.label, x(from) + 4, pad.top + 11);
        }
      }

      const step = niceStep(maxY - minY, 4);
      const digits = yDigits ?? (step < 0.1 ? 2 : step < 1 ? 1 : 0);
      context.strokeStyle = grid;
      context.lineWidth = 1;
      context.textAlign = "right";
      context.fillStyle = muted;
      for (let value = Math.ceil(minY / step) * step; value <= maxY + 1e-9; value += step) {
        const yy = Math.round(y(value)) + 0.5;
        context.beginPath();
        context.moveTo(pad.left, yy);
        context.lineTo(width - pad.right, yy);
        context.stroke();
        context.fillText(formatNumber(value, digits), pad.left - 6, yy + 4);
      }
      if (minY < 0 && maxY > 0) {
        context.strokeStyle = muted;
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(pad.left, Math.round(y(0)) + 0.5);
        context.lineTo(width - pad.right, Math.round(y(0)) + 0.5);
        context.stroke();
      }

      context.fillStyle = muted;
      context.textAlign = "center";
      const xStep = niceStep(xSpan, 5);
      for (let value = Math.ceil(minX / xStep) * xStep; value <= maxX + 1e-9; value += xStep) {
        context.fillText(formatNumber(value, xStep < 1 ? 1 : 0), x(value), h - 14);
      }
      context.fillText(xLabel, pad.left + plotW / 2, h - 2);
      context.save();
      context.translate(10, pad.top + plotH / 2);
      context.rotate(-Math.PI / 2);
      context.fillText(yLabel, 0, 0);
      context.restore();

      for (const line of lines) {
        if (line.y < minY || line.y > maxY) continue;
        context.strokeStyle = line.color;
        context.lineWidth = 1.5;
        context.setLineDash(line.dashed === false ? [] : [6, 5]);
        context.beginPath();
        context.moveTo(pad.left, y(line.y));
        context.lineTo(width - pad.right, y(line.y));
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = line.color;
        context.textAlign = "right";
        context.fillText(line.label, width - pad.right - 4, y(line.y) - 5);
      }

      for (const item of series) {
        context.strokeStyle = item.color;
        context.lineWidth = item.width ?? 2;
        context.setLineDash(item.dashed ? [6, 4] : []);
        context.beginPath();
        let previous: ChartPoint | null = null;
        for (const point of item.points) {
          if (!previous || (item.maxGap !== undefined && point.x - previous.x > item.maxGap)) context.moveTo(x(point.x), y(point.y));
          else context.lineTo(x(point.x), y(point.y));
          previous = point;
        }
        context.stroke();
        context.setLineDash([]);
      }
    };
    draw();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(draw);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [series, bands, lines, xLabel, yLabel, height, yDigits]);

  return (
    <div>
      <canvas ref={canvasRef} className="block w-full" style={{ height }} role="img" aria-label={ariaLabel} />
      {series.length > 1 && (
        <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-micro text-text-secondary">
          {series.map((item) => (
            <li key={item.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full" style={{ background: item.color }} />
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
