"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MATRIX_RANKS, cellIndex, cellOf } from "@/app/(poker)/handMatrix";
import { clamp } from "@/lib/num";

/* One terrain, two surfaces. The 13×13 starting-hand matrix drawn as an
   isometric mesh: a vertex per class, height in [0, 1], triangles painted by
   the caller (the Landscape colours by equity, the Decisions surface by best
   action) and painter-sorted far→near. A new `target` tweens the mesh from
   where it is to where it should be, so every deformation on screen is a real
   change in the numbers underneath. Drag rotates; the nearest vertex under
   the pointer is the hover; a click without a drag selects it. */

export const TERRAIN_W = 820;
export const TERRAIN_H = 520;
const CX = TERRAIN_W / 2;
const CY = TERRAIN_H / 2 + 40;
const SCALE = 26;   // world unit → px
const HEIGHT = 190; // px at height 1.0


/** Colour of one triangle from its three vertex cells, mean height and a slope shade in [0.25, 1]. */
export type TriFill = (p: number, q: number, r: number, mean: number, shade: number) => string;

type Props = {
  /** 169 heights in [0, 1], matrix order. A new array identity starts a tween. */
  target: ArrayLike<number>;
  triFill: TriFill;
  hover: number | null;
  onHover: (k: number | null) => void;
  /** A click that did not drag. */
  onSelect?: (k: number) => void;
  selected?: number | null;
  pending?: boolean;
  ariaLabel: string;
  /** Overlays (tooltips, notices) — absolutely positioned inside the frame. */
  children?: ReactNode;
};

type Drag = { x: number; y: number; az: number; el: number; moved: boolean };

export default function Terrain({ target, triFill, hover, onHover, onSelect, selected = null, pending = false, ariaLabel, children }: Props) {
  const [view, setView] = useState({ az: 0.62, el: 0.95 });
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false); // render-side mirror of drag.current (cursor)

  // displayed heights tween toward `target`; every state write happens inside
  // a frame callback, never synchronously in the effect body
  const [shown, setShown] = useState<Float32Array>(() => new Float32Array(169));
  const shownRef = useRef(shown);
  useEffect(() => { shownRef.current = shown; }, [shown]);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = Float32Array.from(shownRef.current);
    const to = new Float32Array(169);
    for (let k = 0; k < 169; k++) to[k] = clamp(Number(target[k]) || 0, 0, 1);
    const t0 = performance.now();
    const DUR = reduce ? 0 : 700;
    let raf = 0;
    const step = (now: number) => {
      const u = DUR === 0 ? 1 : clamp((now - t0) / DUR, 0, 1);
      const e = 1 - Math.pow(1 - u, 3); // easeOut cubic
      const next = new Float32Array(169);
      for (let k = 0; k < 169; k++) next[k] = from[k]! + (to[k]! - from[k]!) * e;
      setShown(next);
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  // ── projection ──────────────────────────────────────────────────────────
  const project = useCallback(
    (i: number, j: number, h: number) => {
      const u = j - 6, v = i - 6;
      const ca = Math.cos(view.az), sa = Math.sin(view.az);
      const ur = u * ca - v * sa, vr = u * sa + v * ca;
      const se = Math.sin(view.el), ce = Math.cos(view.el);
      return { x: CX + ur * SCALE, y: CY + vr * SCALE * ce - h * HEIGHT * se, depth: vr };
    },
    [view],
  );

  // triangles, painter-sorted far→near, with a slope shade
  const tris = useMemo(() => {
    const P: { x: number; y: number; depth: number }[] = [];
    for (let k = 0; k < 169; k++) {
      const { i, j } = cellOf(k);
      P.push(project(i, j, shown[k]!));
    }
    const out: { pts: string; depth: number; fill: string }[] = [];
    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        const a = cellIndex(i, j), b = cellIndex(i, j + 1), c = cellIndex(i + 1, j + 1), d = cellIndex(i + 1, j);
        for (const [p, q, r] of [[a, b, c], [a, c, d]] as const) {
          const A = P[p]!, B = P[q]!, C = P[r]!;
          const ha = shown[p]!, hb = shown[q]!, hc = shown[r]!;
          const mean = (ha + hb + hc) / 3;
          // shade from the height gradient across the triangle (fake light from the upper-left)
          const slope = ((hb - ha) + (hc - ha)) * 2.2;
          const shade = clamp(0.55 + slope, 0.25, 1);
          out.push({
            pts: `${A.x.toFixed(1)},${A.y.toFixed(1)} ${B.x.toFixed(1)},${B.y.toFixed(1)} ${C.x.toFixed(1)},${C.y.toFixed(1)}`,
            depth: (A.depth + B.depth + C.depth) / 3,
            fill: triFill(p, q, r, mean, shade),
          });
        }
      }
    }
    out.sort((s, t) => s.depth - t.depth);
    return out;
  }, [project, shown, triFill]);

  // ── pointer: rotate, hover the nearest vertex, click to select ──────────
  const svgRef = useRef<SVGSVGElement>(null);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      setView({ az: d.az + dx * 0.008, el: clamp(d.el - dy * 0.006, 0.35, 1.45) });
      return;
    }
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * TERRAIN_W, py = ((e.clientY - rect.top) / rect.height) * TERRAIN_H;
    let best = -1, bd = Infinity;
    for (let k = 0; k < 169; k++) {
      const { i, j } = cellOf(k);
      const p = project(i, j, shown[k]!);
      const dd = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (dd < bd) { bd = dd; best = k; }
    }
    onHover(bd < 30 * 30 ? best : null);
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, az: view.az, el: view.el, moved: false };
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && !d.moved && hover !== null && onSelect) onSelect(hover);
  };

  const marker = (k: number, color: string, ring: boolean) => {
    const { i, j } = cellOf(k);
    const p = project(i, j, shown[k]!);
    const g = project(i, j, 0);
    return (
      <g>
        <line x1={g.x} y1={g.y} x2={p.x} y2={p.y} stroke={color} strokeWidth={1} strokeOpacity={0.7} />
        {ring
          ? <circle cx={p.x} cy={p.y} r={7} fill="none" stroke={color} strokeWidth={2} />
          : <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="var(--color-bg)" strokeWidth={2} />}
      </g>
    );
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${TERRAIN_W} ${TERRAIN_H}`}
        className={`w-full h-auto select-none touch-none ${pending ? "opacity-70" : ""} transition-opacity`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={() => { drag.current = null; setDragging(false); onHover(null); }}
        style={{ cursor: dragging ? "grabbing" : "crosshair" }}
      >
        {/* ground plane */}
        {(() => {
          const c = [project(0, 0, 0), project(0, 12, 0), project(12, 12, 0), project(12, 0, 0)];
          return <polygon points={c.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} fill="rgb(var(--brand-purple-rgb) / 0.05)" stroke="rgb(var(--brand-purple-rgb) / 0.18)" strokeWidth={1} />;
        })()}
        {/* surface */}
        {tris.map((t, idx) => (
          <polygon key={idx} points={t.pts} fill={t.fill} stroke={t.fill} strokeWidth={0.6} />
        ))}
        {/* axis labels: ranks along the two front edges */}
        {MATRIX_RANKS.split("").map((r, i) => {
          const a = project(i, -0.9, 0), b = project(-0.9, i, 0);
          return (
            <g key={r} fontFamily="var(--font-mono), monospace" fontSize={11} fill="var(--color-muted)">
              <text x={a.x} y={a.y + 4} textAnchor="middle">{r}</text>
              <text x={b.x} y={b.y + 4} textAnchor="middle">{r}</text>
            </g>
          );
        })}
        {selected !== null && selected !== hover && marker(selected, "var(--color-accent-dim)", true)}
        {hover !== null && marker(hover, "var(--color-secondary)", false)}
      </svg>
      {children}
    </div>
  );
}
