"use client";

import { useRef, type ReactNode } from "react";
import { axisTicks } from "./format";

/* A small multi-series line chart shared by the Pallas demos, dataviz-spec:
   2px lines, hairline grid, legend with line keys, crosshair tooltip on the
   nearest index. Colours are validated on the dark surface. Until a series
   has data it draws no axis at all — just the frame and what will fill it. */

export const ORIGINAL = "#a35cff";   // purple
export const ADVERSARIAL = "#1fb14a"; // green
export const SERIES_COLORS = [ORIGINAL, ADVERSARIAL, "#febc2e", "#f2f2f2"]; // purple, green, amber, ink

export default function LineChart({
  series, labels, height = 220, hover, onHover, format, id, colors = SERIES_COLORS, baseline, empty,
}: {
  series: (number[] | null)[];
  labels: string[];
  height?: number;
  hover: number | null;
  onHover: (i: number | null) => void;
  format: (v: number) => string;
  id: string;
  colors?: string[];
  /** A horizontal reference (e.g. the starting balance). */
  baseline?: number;
  /** What the frame says before any series has data. */
  empty?: ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const W = 760, H = height, PAD = { t: 14, r: 16, b: 26, l: 56 };
  if (!series.some((s) => s && s.length > 0)) {
    return (
      <div className="flex items-center justify-center rounded-md border border-dashed border-border px-4 text-center" style={{ aspectRatio: `${W} / ${H}` }}>
        <p className="font-mono text-fluid-xs text-muted">{empty}</p>
      </div>
    );
  }
  const pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
  const all = series.flatMap((s) => s ?? []);
  if (baseline !== undefined) all.push(baseline);
  const n = Math.max(...series.map((s) => s?.length ?? 0), 2);
  const lo = Math.min(...all), hi = Math.max(...all);
  const span = Math.max(hi - lo, 1e-6);
  const y = (v: number) => PAD.t + ph - ((v - lo) / span) * ph;
  const x = (i: number) => PAD.l + (i / (n - 1)) * pw;
  const ticks = axisTicks(lo, hi, format);
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    onHover(Math.round(Math.min(1, Math.max(0, (px - PAD.l) / pw)) * (n - 1)));
  };
  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-4 px-1 pb-1 font-mono text-[0.62rem] text-muted">
        {labels.map((l, i) => series[i] ? (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[2px] w-4 rounded" style={{ background: colors[i] }} />{l}
          </span>
        ) : null)}
      </div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none touch-none" role="img" aria-labelledby={id}
           onPointerMove={move} onPointerLeave={() => onHover(null)}>
        <title id={id}>{labels.filter((_, i) => series[i]).join(" vs ")}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--brand-purple-rgb) / 0.14)" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fontFamily="var(--font-mono), monospace" fill="var(--color-muted)">{format(t)}</text>
          </g>
        ))}
        {baseline !== undefined && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(baseline)} y2={y(baseline)} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="3 4" strokeOpacity={0.7} />
        )}
        {series.map((s, si) => s ? (
          <path key={si} d={s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")}
                fill="none" stroke={colors[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ) : null)}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ph} stroke="rgb(var(--brand-purple-rgb) / 0.35)" strokeWidth={1} />
            {series.map((s, si) => s && s[hover] !== undefined ? (
              <circle key={si} cx={x(hover)} cy={y(s[hover]!)} r={4} fill={colors[si]} stroke="var(--color-bg)" strokeWidth={2} />
            ) : null)}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-6 rounded-md border border-accent/25 bg-surface px-3 py-2 shadow-card font-mono text-[0.66rem]"
             style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > n / 2 ? "-105%" : "5%"})` }}>
          <p className="text-muted mb-1">bar {hover + 1} of {n}</p>
          {series.map((s, si) => s && s[hover] !== undefined ? (
            <p key={si} className="flex items-center gap-2 text-ink">
              <span className="inline-block h-[2px] w-3 rounded" style={{ background: colors[si] }} />
              <span className="font-semibold">{format(s[hover]!)}</span>
              <span className="text-muted">{labels[si]}</span>
            </p>
          ) : null)}
        </div>
      )}
    </div>
  );
}
