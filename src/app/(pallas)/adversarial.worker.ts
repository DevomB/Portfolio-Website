/* The Adversarial Tape search, off the main thread.
   Given a tape and a strategy, hill-climb (simulated annealing) over price
   paths that make the strategy lose the most — with the first and last close
   PINNED. The attacker cannot crash the market; it can only reorder time. That
   makes every result a statement about path risk: whipsaws for
   trend-followers, grinding trends for mean-reverters, and nothing at all for
   buy-and-hold, whose P&L is fixed by the endpoints.

   Every candidate is scored by the real engine (Athena's Pallas in WASI). */

import { PallasArena } from "./pallasArena";
import {
  annualisedVol, fromReturns, logReturns, toCsv,
  type SearchMessage, type SearchProgress, type SearchStart,
} from "./tape";
import { mulberry32 } from "@/app/(poker)/poker";

let arena: PallasArena | null = null;
let stop = false;
const post = (m: SearchMessage) => (self as unknown as Worker).postMessage(m);

const pnlOf = (r: { pnl: string }) => Number.parseFloat(r.pnl);
const equityOf = (r: { equity_curve: { equity_quote: string }[] }) => r.equity_curve.map((p) => Number.parseFloat(p.equity_quote));

const MAX_RET = 0.06; // no single day beyond ±6% — a market, not a glitch

type Scored = { pnl: number; equity: number[] };
type Best = Scored & { closes: number[] };

/** The search: the tape under attack, its baseline, the constraints, the scorer. */
type Search = {
  closes: number[];
  base: Scored;
  maxIters: number;
  volCap: number; // multiple of the original tape's annualised vol
  baseVol: number;
  rng: () => number;
  score: (closes: number[]) => Scored;
};

/** One proposal: a move on the log-return series that keeps its sum (→ endpoints). */
function propose(rets: number[], rng: () => number): number[] {
  const out = rets.slice();
  const n = out.length;
  const kind = rng();
  if (kind < 0.45) {
    // reverse a block — reorders time inside the window, sum unchanged
    const len = 3 + Math.floor(rng() * Math.min(40, n / 4));
    const a = Math.floor(rng() * (n - len));
    out.splice(a, len, ...out.slice(a, a + len).reverse());
  } else if (kind < 0.8) {
    // swap two blocks of equal length
    const len = 2 + Math.floor(rng() * Math.min(20, n / 6));
    const a = Math.floor(rng() * (n - 2 * len));
    const b = a + len + Math.floor(rng() * (n - a - 2 * len));
    for (let i = 0; i < len; i++) { const t = out[a + i]!; out[a + i] = out[b + i]!; out[b + i] = t; }
  } else {
    // shift mass between two days: one return up, another down by the same amount
    const i = Math.floor(rng() * n), j = Math.floor(rng() * n);
    const d = (rng() - 0.5) * 0.02;
    out[i] = out[i]! + d; out[j] = out[j]! - d;
  }
  return out;
}

/** An admissible candidate from the current returns, or null when the proposal breaks a constraint. */
function candidate(s: Search, curRets: number[]): { rets: number[]; closes: number[] } | null {
  const rets = propose(curRets, s.rng);
  if (rets.some((r) => Math.abs(r) > MAX_RET)) return null;
  const closes = fromReturns(s.closes[0]!, rets);
  if (annualisedVol(closes) > s.baseVol * s.volCap) return null;
  return { rets, closes };
}

/** Simulated annealing over reorderings of time, minimising P&L. Reports every
    improvement and every 25th step; stops early when told to. */
function anneal(s: Search, report: (p: SearchProgress) => void): { best: Best; evals: number } {
  const t0 = performance.now();
  // temperature in P&L units: start at a meaningful fraction of the balance, cool geometrically
  const T0 = 150, Tend = 2;
  let curRets = logReturns(s.closes);
  let cur = s.base.pnl;
  let best: Best = { pnl: s.base.pnl, closes: s.closes.slice(), equity: s.base.equity };
  let accepted = 0, evals = 1;

  for (let iter = 1; iter <= s.maxIters && !stop; iter++) {
    const T = T0 * Math.pow(Tend / T0, iter / s.maxIters);
    const cand = candidate(s, curRets);
    if (!cand) continue;
    const sc = s.score(cand.closes);
    evals++;
    const delta = sc.pnl - cur; // we MINIMISE pnl
    const accept = delta <= 0 || s.rng() < Math.exp(-delta / T);
    let improved = false;
    if (accept) {
      accepted++;
      curRets = cand.rets; cur = sc.pnl;
      if (sc.pnl < best.pnl) { best = { pnl: sc.pnl, closes: cand.closes, equity: sc.equity }; improved = true; }
    }
    if (improved || iter % 25 === 0) {
      report({
        type: "progress", iter, evals, accepted, improved,
        bestPnl: best.pnl, basePnl: s.base.pnl, currentPnl: cur, temperature: T,
        bestCloses: best.closes, bestEquity: best.equity,
        evalsPerSec: evals / ((performance.now() - t0) / 1000),
      });
    }
  }
  return { best, evals };
}

self.onmessage = async (ev: MessageEvent<SearchStart | { type: "stop" }>) => {
  const msg = ev.data;
  if (msg.type === "stop") { stop = true; return; }
  stop = false;
  try {
    if (!arena) {
      arena = await PallasArena.load();
      post({ type: "ready" });
    }
    const { closes, strategy, params, seed, maxIters, volCap } = msg;
    const score = (c: number[]): Scored => {
      const r = arena!.run(toCsv(c), strategy, params);
      return { pnl: pnlOf(r), equity: equityOf(r) };
    };
    const base = score(closes);
    post({ type: "baseline", pnl: base.pnl, equity: base.equity });

    const { best, evals } = anneal({ closes, base, maxIters, volCap, baseVol: annualisedVol(closes), rng: mulberry32(seed >>> 0), score }, post);
    post({ type: "done", iter: maxIters, bestPnl: best.pnl, bestCloses: best.closes, bestEquity: best.equity, evals });
  } catch (e) {
    post({ type: "error", message: (e as Error).message });
  }
};
