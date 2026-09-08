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
  type SearchDone, type SearchMessage, type SearchProgress, type SearchStart,
} from "./tape";
import { mulberry32 } from "@/app/(poker)/poker";

let arena: PallasArena | null = null;
let stop = false;

const pnlOf = (r: { pnl: string }) => Number.parseFloat(r.pnl);
const equityOf = (r: { equity_curve: { equity_quote: string }[] }) => r.equity_curve.map((p) => Number.parseFloat(p.equity_quote));

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

self.onmessage = async (ev: MessageEvent<SearchStart | { type: "stop" }>) => {
  const msg = ev.data;
  if (msg.type === "stop") { stop = true; return; }
  stop = false;
  try {
    if (!arena) {
      arena = await PallasArena.load();
      (self as unknown as Worker).postMessage({ type: "ready" } satisfies SearchMessage);
    }
    const { closes, strategy, params, seed, maxIters, volCap } = msg;
    const rng = mulberry32(seed >>> 0);
    const start = closes[0]!;
    const baseVol = annualisedVol(closes);
    const maxRet = 0.06; // no single day beyond ±6% — a market, not a glitch

    const score = (c: number[]) => {
      const r = arena!.run(toCsv(c), strategy, params);
      return { pnl: pnlOf(r), equity: equityOf(r) };
    };

    const base = score(closes);
    (self as unknown as Worker).postMessage({ type: "baseline", pnl: base.pnl, equity: base.equity } satisfies SearchMessage);
    let curRets = logReturns(closes);
    let cur = base.pnl;
    let best = { pnl: base.pnl, closes: closes.slice(), equity: base.equity };
    let accepted = 0, evals = 1;
    const t0 = performance.now();
    // temperature in P&L units: start at a meaningful fraction of the balance, cool geometrically
    const T0 = 150, Tend = 2;

    for (let iter = 1; iter <= maxIters && !stop; iter++) {
      const T = T0 * Math.pow(Tend / T0, iter / maxIters);
      const cand = propose(curRets, rng);
      if (cand.some((r) => Math.abs(r) > maxRet)) continue;
      const candCloses = fromReturns(start, cand);
      if (annualisedVol(candCloses) > baseVol * volCap) continue;
      const s = score(candCloses);
      evals++;
      const delta = s.pnl - cur; // we MINIMISE pnl
      const accept = delta <= 0 || rng() < Math.exp(-delta / T);
      let improved = false;
      if (accept) {
        accepted++;
        curRets = cand; cur = s.pnl;
        if (s.pnl < best.pnl) { best = { pnl: s.pnl, closes: candCloses, equity: s.equity }; improved = true; }
      }
      if (improved || iter % 25 === 0) {
        const progress: SearchProgress = {
          type: "progress", iter, evals, accepted, improved,
          bestPnl: best.pnl, basePnl: base.pnl, currentPnl: cur, temperature: T,
          bestCloses: best.closes, bestEquity: best.equity,
          evalsPerSec: evals / ((performance.now() - t0) / 1000),
        };
        (self as unknown as Worker).postMessage(progress);
      }
    }
    const done: SearchDone = { type: "done", iter: maxIters, bestPnl: best.pnl, bestCloses: best.closes, bestEquity: best.equity, evals };
    (self as unknown as Worker).postMessage(done);
  } catch (e) {
    (self as unknown as Worker).postMessage({ type: "error", message: (e as Error).message } satisfies SearchMessage);
  }
};
