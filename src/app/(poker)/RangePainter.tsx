"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { RANGE_PRESETS, cellOf, classLabel, rangeComboCount } from "@/app/(poker)/handMatrix";

/* The 13×13 range painter shared by the poker surfaces. Click or drag to
   paint; presets are broad brushes. `shade` tints painted cells (0..1). */

export function paintPreset(key: string): boolean[] {
  const preset = RANGE_PRESETS.find((p) => p.key === key) ?? RANGE_PRESETS[0]!;
  return Array.from({ length: 169 }, (_, k) => preset.classes.has(classLabel(cellOf(k).i, cellOf(k).j)));
}

type Props = {
  title: string;
  range: boolean[];
  setRange: Dispatch<SetStateAction<boolean[]>>;
  /** Cards that make combos dead, for the live-combo count. */
  board: readonly string[];
  hover: number | null;
  onHover: (k: number | null) => void;
  shade?: (k: number) => number;
  caption: string;
};

export default function RangePainter({ title, range, setRange, board, hover, onHover, shade, caption }: Props) {
  const [painting, setPainting] = useState<boolean | null>(null); // value being painted during a drag
  const paintCell = (k: number, value: boolean) => setRange((r) => (r[k] === value ? r : r.map((v, i) => (i === k ? value : v))));
  const combos = useMemo(() => rangeComboCount(range, board), [range, board]);
  const pctOfAll = ((combos / 1326) * 100).toFixed(1);

  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-fluid-xs text-muted">{title} · {combos} combos · {pctOfAll}%</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {RANGE_PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => setRange(paintPreset(p.key))}
                  className="chip-soft px-2 py-0.5 font-mono text-fluid-xs text-muted hover:text-ink hover:border-accent/40 transition-colors">
            {p.label}
          </button>
        ))}
        <button type="button" onClick={() => setRange(new Array(169).fill(false))}
                className="chip-soft px-2 py-0.5 font-mono text-fluid-xs text-muted hover:text-ink transition-colors">
          none
        </button>
      </div>
      <div
        className="mt-3 grid select-none touch-none grid-cols-[repeat(13,minmax(0,1fr))] gap-px sm:gap-[2px]"
        onPointerLeave={() => setPainting(null)}
        onPointerUp={() => setPainting(null)}
      >
        {Array.from({ length: 169 }, (_, k) => {
          const { i, j } = cellOf(k);
          const on = range[k];
          const t = shade ? shade(k) : 0.5;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={on}
              aria-label={classLabel(i, j)}
              onPointerDown={(e) => { e.preventDefault(); const v = !on; setPainting(v); paintCell(k, v); }}
              onPointerEnter={() => { if (painting !== null) paintCell(k, painting); }}
              onMouseEnter={() => onHover(k)}
              onMouseLeave={() => onHover(null)}
              className={`aspect-square overflow-hidden rounded-[2px] font-mono text-[0.5625rem] leading-none tracking-tighter transition-colors xl:text-[0.625rem] ${on ? "text-ink" : "text-muted"}`}
              style={{
                background: on
                  ? `rgb(var(--brand-green-rgb) / ${0.18 + 0.5 * t})`
                  : "rgb(var(--brand-purple-rgb) / 0.07)",
                outline: hover === k ? "1px solid var(--color-secondary)" : undefined,
              }}
            >
              {classLabel(i, j)}
            </button>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-fluid-xs text-muted">{caption}</p>
    </div>
  );
}
