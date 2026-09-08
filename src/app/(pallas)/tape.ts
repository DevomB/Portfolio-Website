/* Price tapes for the Adversarial Tape demo.
   A tape is a list of daily closes; the engine gets it as OHLCV CSV. Everything
   here is deterministic from a seed so a "world" can be reproduced and shared. */

import { mulberry32 } from "@/app/(poker)/poker";
import { normal } from "./gaussian";
import type { ArenaParams, ArenaStrategy } from "./pallasArena";

export const TAPE_LEN = 250; // one trading year of daily bars

/** Geometric Brownian motion, ~18% annualised vol, slight positive drift. */
export function makeTape(seed: number, n = TAPE_LEN, start = 100): number[] {
  const rng = mulberry32(seed >>> 0);
  const mu = 0.06 / 252, sigma = 0.18 / Math.sqrt(252);
  const closes = [start];
  for (let i = 1; i < n; i++) {
    const r = mu - (sigma * sigma) / 2 + sigma * normal(rng);
    closes.push(closes[i - 1]! * Math.exp(r));
  }
  return closes;
}

export const logReturns = (closes: number[]) => closes.slice(1).map((c, i) => Math.log(c / closes[i]!));

export function fromReturns(start: number, rets: number[]): number[] {
  const out = [start];
  for (const r of rets) out.push(out[out.length - 1]! * Math.exp(r));
  return out;
}

/** The same returns in a random order: same distribution, no structure. */
export function shuffledCloses(closes: number[], rng: () => number): number[] {
  const r = logReturns(closes);
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = r[i]!; r[i] = r[j]!; r[j] = t;
  }
  return fromReturns(closes[0]!, r);
}

/** Trading-day dates from 2024-01-02, skipping weekends — the engine wants a `ts` column. */
export function tradingDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(2024, 0, 2));
  while (out.length < n) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** OHLCV rows the engine's CSV loader accepts. Open = previous close; a small
    intrabar range around open/close so highs and lows are never degenerate. */
export function toCsv(closes: number[], dates = tradingDates(closes.length)): string {
  const lines = ["ts,open,high,low,close,volume"];
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i]!;
    const o = i === 0 ? c : closes[i - 1]!;
    const hi = Math.max(o, c) * 1.004;
    const lo = Math.min(o, c) * 0.996;
    lines.push(`${dates[i]},${o.toFixed(4)},${hi.toFixed(4)},${lo.toFixed(4)},${c.toFixed(4)},1000000`);
  }
  return lines.join("\n") + "\n";
}

export function annualisedVol(closes: number[]): number {
  const r = logReturns(closes);
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const v = r.reduce((a, b) => a + (b - m) * (b - m), 0) / Math.max(1, r.length - 1);
  return Math.sqrt(v * 252);
}

// ── what the Adversarial Tape worker says ────────────────────────────────
// The page starts a search over a tape and reads progress back; the types
// live here, with the tapes, so the page never has to import the worker.

export type SearchStart = {
  type: "start";
  closes: number[];
  strategy: ArenaStrategy;
  params: ArenaParams;
  seed: number;
  maxIters: number;
  volCap: number; // multiple of the original tape's annualised vol
};
export type SearchProgress = {
  type: "progress";
  iter: number;
  evals: number;
  accepted: number;
  improved: boolean;
  bestPnl: number;
  basePnl: number;
  currentPnl: number;
  temperature: number;
  bestCloses: number[];
  bestEquity: number[];
  evalsPerSec: number;
};
export type SearchDone = { type: "done"; iter: number; bestPnl: number; bestCloses: number[]; bestEquity: number[]; evals: number };
export type SearchError = { type: "error"; message: string };
export type SearchBaseline = { type: "baseline"; pnl: number; equity: number[] };
export type SearchMessage = SearchProgress | SearchDone | SearchError | SearchBaseline | { type: "ready" };
