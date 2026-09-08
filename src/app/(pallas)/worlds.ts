/* Worlds and grids for the Mirage.

   A world is a 750-bar daily tape: 500 bars in-sample, 250 held out. Log
   returns follow r_t = φ·r_{t−1} + ε_t with ε ~ N(0, σ²), σ scaled so every
   world has the same unconditional volatility (18% annualised). φ = 0 is
   pure noise: there is nothing to find. φ > 0 plants persistence a trend
   follower can exploit; φ < 0 plants reversal. Everything is seeded.

   Scores are read off the engine's own equity curve over a bar window, so
   in-sample, walk-forward and held-out numbers are computed the same way. */

import { mulberry32 } from "@/app/(poker)/poker";
import { clamp } from "@/lib/num";
import { normal } from "./gaussian";
import type { ArenaParams } from "./pallasArena";

export const IS_BARS = 500;
export const OOS_BARS = 250;
export const WORLD_BARS = IS_BARS + OOS_BARS;
/** Bars of history a strategy sees before a scored segment begins. */
export const WARMUP = 250;
/** Walk-forward quarter boundaries inside the held-out year. */
export const FOLDS = [500, 562, 625, 687, 750];
export const INITIAL_BALANCE = 10_000;
export const PHI_MAX = 0.35;

export type WorldKind = "noise" | "trend" | "reversion";
export const WORLDS: { key: WorldKind; label: string; blurb: string }[] = [
  { key: "noise", label: "noise", blurb: "independent returns — there is nothing to find" },
  { key: "trend", label: "planted trend", blurb: "returns persist: today leans the way yesterday went" },
  { key: "reversion", label: "planted reversal", blurb: "returns reverse: today leans against yesterday" },
];

export const phiOf = (kind: WorldKind, strength: number) =>
  kind === "noise" ? 0 : (kind === "trend" ? 1 : -1) * PHI_MAX * clamp(strength, 0, 1);

const START_PRICE = 100;

export function makeWorld(seed: number, kind: WorldKind, strength: number, n = WORLD_BARS): number[] {
  const rng = mulberry32(seed >>> 0);
  const phi = phiOf(kind, strength);
  const sigma = (0.18 / Math.sqrt(252)) * Math.sqrt(1 - phi * phi);
  const closes = [START_PRICE];
  let prev = 0;
  for (let i = 1; i < n; i++) {
    const r = phi * prev + sigma * normal(rng);
    closes.push(closes[i - 1]! * Math.exp(r));
    prev = r;
  }
  return closes;
}

// ── parameter grids ───────────────────────────────────────────────────────

export type Family = "sma_cross" | "momentum" | "mean_revert";
export type Axis = { key: keyof ArenaParams; label: string; values: number[] };
export type FamilySpec = { label: string; blurb: string; x: Axis; y: Axis | null };

export const FAMILIES: Record<Family, FamilySpec> = {
  sma_cross: {
    label: "SMA crossover",
    blurb: "long when the fast average is above the slow one",
    x: { key: "fast", label: "fast", values: [2, 3, 5, 8, 10, 12, 15, 18] }, // every fast < every slow
    y: { key: "slow", label: "slow", values: [20, 30, 40, 50, 60, 80, 100, 120] },
  },
  momentum: {
    label: "Momentum",
    blurb: "long when price is above where it was N bars ago",
    x: { key: "lookback", label: "lookback", values: [2, 3, 5, 8, 10, 15, 20, 30, 40, 60, 80, 100] },
    y: null,
  },
  mean_revert: {
    label: "Mean reversion",
    blurb: "buy z standard deviations below the mean, sell at the mean",
    x: { key: "lookback", label: "lookback", values: [5, 10, 15, 20, 30, 40, 60, 80] },
    y: { key: "z_entry", label: "z entry", values: [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3] },
  },
};

export type Cell = { index: number; xi: number; yi: number; params: ArenaParams; label: string };

export function gridShape(family: Family): { nx: number; ny: number } {
  const f = FAMILIES[family];
  return { nx: f.x.values.length, ny: f.y ? f.y.values.length : 1 };
}

export function gridCells(family: Family): Cell[] {
  const f = FAMILIES[family];
  const out: Cell[] = [];
  const ys: (number | null)[] = f.y ? f.y.values : [null];
  ys.forEach((yv, yi) => {
    f.x.values.forEach((xv, xi) => {
      const params: ArenaParams = { [f.x.key]: xv };
      if (f.y && yv !== null) params[f.y.key] = yv;
      out.push({ index: out.length, xi, yi, params, label: f.y ? `${f.x.label} ${xv} · ${f.y.label} ${yv}` : `${f.x.label} ${xv}` });
    });
  });
  return out;
}

/** A cell and every grid neighbour it has (8-connected), itself included. */
export function neighbours(family: Family, index: number): number[] {
  const { nx, ny } = gridShape(family);
  const xi = index % nx, yi = Math.floor(index / nx);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = xi + dx, y = yi + dy;
      if (x >= 0 && x < nx && y >= 0 && y < ny) out.push(y * nx + x);
    }
  }
  return out;
}

export const argmax = (xs: number[]) => xs.reduce((b, v, i) => (v > xs[b]! ? i : b), 0);

/** The cell whose neighbourhood mean is best — a plateau, not a peak. */
export function plateauPick(family: Family, scores: number[]): number {
  const means = scores.map((_, i) => {
    const nb = neighbours(family, i);
    return nb.reduce((s, j) => s + scores[j]!, 0) / nb.length;
  });
  return argmax(means);
}

// ── scores from an equity curve ───────────────────────────────────────────

export type Metric = "pnl" | "sharpe";

const before = (equity: number[], from: number) => (from === 0 ? INITIAL_BALANCE : equity[from - 1]!);

/** Chips made over bars [from, to). */
export function segmentPnl(equity: number[], from: number, to: number): number {
  return equity[Math.min(to, equity.length) - 1]! - before(equity, from);
}

/** Annualised Sharpe of the equity's daily simple returns over bars [from, to). */
export function segmentSharpe(equity: number[], from: number, to: number): number {
  const end = Math.min(to, equity.length);
  const rets: number[] = [];
  let prev = before(equity, from);
  for (let i = from; i < end; i++) { rets.push(equity[i]! / prev - 1); prev = equity[i]!; }
  if (rets.length < 2) return 0;
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = rets.reduce((a, b) => a + (b - m) * (b - m), 0) / (rets.length - 1);
  return v > 0 ? (m / Math.sqrt(v)) * Math.sqrt(252) : 0;
}

/** Equity over bars [from, to), shifted so it starts from the initial balance. */
export function rebase(equity: number[], from: number, to: number): number[] {
  const b = before(equity, from);
  return equity.slice(from, Math.min(to, equity.length)).map((e) => e - b + INITIAL_BALANCE);
}

// ── what the Mirage worker says ───────────────────────────────────────────
// The experiment's inputs and outputs, in the module that defines the
// experiment; the page and the worker both import them from here.

export type MirageStart = {
  type: "start";
  seed: number;
  kind: WorldKind;
  strength: number;
  family: Family;
  metric: Metric;
  permutations: number;
  qty: number;
};
export type CellScore = { pnl: number; sharpe: number; trades: number };
export type WalkFold = { fold: number; from: number; to: number; pick: number; pnl: number; sharpe: number };
export type Segment = { pnl: number; sharpe: number; equity: number[] };
export type Phase = "sweep" | "walk" | "noise" | "holdout";
export type MirageProgress = {
  type: "progress";
  phase: Phase;
  done: number;
  total: number;
  grid: (CellScore | null)[];
  walk: WalkFold[];
  noiseMax: number[];
  evals: number;
  evalsPerSec: number;
};
export type MirageDone = {
  type: "done";
  grid: CellScore[];
  peak: number;
  plateau: number;
  walk: WalkFold[];
  /** `hold` is the reference: long from the first held-out bar, no decisions. */
  holdout: { peak: Segment; plateau: Segment; walk: Segment; hold: Segment };
  noiseMax: number[];
  pValue: number;
  evals: number;
  ms: number;
};
export type MirageMessage =
  | { type: "ready" }
  | { type: "world"; closes: number[] }
  | MirageProgress
  | MirageDone
  | { type: "error"; message: string };
