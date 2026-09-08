/* The Mirage, off the main thread.
   One world, one strategy family, one parameter grid. Every backtest is the
   real engine (Athena's Pallas in WASI). Four passes:
     sweep    — every cell on the 500 in-sample bars
     walk     — four held-out quarters, each re-selecting on the trailing 250 bars
     noise    — the in-sample returns shuffled M times, the sweep re-run on each,
                the best cell's score recorded: what luck alone produces
     holdout  — the peak and the plateau cell, run through the held-out year
   Progress is posted as cells fill in, so the grid paints live. */

import { PallasArena, type ArenaParams, type ArenaStrategy } from "./pallasArena";
import { shuffledCloses, toCsv } from "./tape";
import { mulberry32 } from "@/app/(poker)/poker";
import {
  FOLDS, INITIAL_BALANCE, IS_BARS, WARMUP, WORLD_BARS,
  argmax, gridCells, makeWorld, plateauPick, rebase, segmentPnl, segmentSharpe,
  type CellScore, type MirageMessage, type MirageStart, type Phase, type Segment, type WalkFold,
} from "./worlds";

let arena: PallasArena | null = null;
let stop = false;
const post = (m: MirageMessage) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (ev: MessageEvent<MirageStart | { type: "stop" }>) => {
  const msg = ev.data;
  if (msg.type === "stop") { stop = true; return; }
  stop = false;
  try {
    if (!arena) {
      arena = await PallasArena.load();
      post({ type: "ready" });
    }
    const { seed, kind, strength, family, metric, permutations, qty } = msg;
    const closes = makeWorld(seed, kind, strength);
    post({ type: "world", closes });
    const cells = gridCells(family);
    const t0 = performance.now();
    let evals = 0;
    const score = (s: CellScore) => (metric === "pnl" ? s.pnl : s.sharpe);

    const run = (tape: number[], params: ArenaParams, strategy: ArenaStrategy = family) => {
      const r = arena!.run(toCsv(tape), strategy, { ...params, qty }, INITIAL_BALANCE);
      evals++;
      return { equity: r.equity_curve.map((p) => Number.parseFloat(p.equity_quote)), trades: r.closed_trades };
    };
    const scoreRun = (tape: number[], params: ArenaParams, from: number, to: number): CellScore => {
      const { equity, trades } = run(tape, params);
      return { pnl: segmentPnl(equity, from, to), sharpe: segmentSharpe(equity, from, to), trades };
    };

    const grid: (CellScore | null)[] = new Array(cells.length).fill(null);
    const walk: WalkFold[] = [];
    const noiseMax: number[] = [];
    let lastPost = 0;
    const progress = (phase: Phase, done: number, total: number, force = false) => {
      const now = performance.now();
      if (!force && now - lastPost < 60) return;
      lastPost = now;
      post({ type: "progress", phase, done, total, grid: grid.slice(), walk: walk.slice(), noiseMax: noiseMax.slice(), evals, evalsPerSec: evals / ((now - t0) / 1000) });
    };

    // ── sweep: every cell on the in-sample bars ──
    const isCloses = closes.slice(0, IS_BARS);
    for (const c of cells) {
      if (stop) throw new Error("stopped");
      grid[c.index] = scoreRun(isCloses, c.params, 0, IS_BARS);
      progress("sweep", c.index + 1, cells.length, c.index === cells.length - 1);
    }
    const full = grid as CellScore[];
    const scores = full.map(score);
    const peak = argmax(scores);
    const plateau = plateauPick(family, scores);

    // ── walk-forward: re-select on the trailing 250 bars, score the next quarter ──
    const walkEquity: number[] = [];
    let cum = 0;
    for (let k = 0; k < FOLDS.length - 1; k++) {
      if (stop) throw new Error("stopped");
      const from = FOLDS[k]!, to = FOLDS[k + 1]!;
      const sel = closes.slice(from - WARMUP, from);
      let best = 0, bestScore = -Infinity;
      for (const c of cells) {
        const s = score(scoreRun(sel, c.params, 0, sel.length));
        if (s > bestScore) { bestScore = s; best = c.index; }
      }
      const { equity } = run(closes.slice(from - WARMUP, to), cells[best]!.params);
      const pnl = segmentPnl(equity, WARMUP, equity.length);
      walk.push({ fold: k + 1, from, to, pick: best, pnl, sharpe: segmentSharpe(equity, WARMUP, equity.length) });
      for (const e of rebase(equity, WARMUP, equity.length)) walkEquity.push(e + cum);
      cum += pnl;
      progress("walk", k + 1, FOLDS.length - 1, true);
    }

    // ── noise: the same in-sample returns, shuffled — what does "best of the grid" look like when there is nothing there? ──
    const rng = mulberry32((Math.imul(seed, 2654435761) + 97) >>> 0);
    for (let m = 0; m < permutations; m++) {
      if (stop) throw new Error("stopped");
      const w = shuffledCloses(isCloses, rng);
      let best = -Infinity;
      for (const c of cells) best = Math.max(best, score(scoreRun(w, c.params, 0, IS_BARS)));
      noiseMax.push(best);
      progress("noise", m + 1, permutations, true);
    }

    // ── holdout: the two picks through the held-out year (250 bars of warm-up first) ──
    const holdoutRun = (params: ArenaParams, strategy?: ArenaStrategy): Segment => {
      const { equity } = run(closes.slice(IS_BARS - WARMUP, WORLD_BARS), params, strategy);
      return { pnl: segmentPnl(equity, WARMUP, equity.length), sharpe: segmentSharpe(equity, WARMUP, equity.length), equity: rebase(equity, WARMUP, equity.length) };
    };
    const hPeak = holdoutRun(cells[peak]!.params);
    progress("holdout", 1, 3, true);
    const hPlateau = holdoutRun(cells[plateau]!.params);
    progress("holdout", 2, 3, true);
    // the reference: buy on the first bar of the run, so simply long through the held-out year
    const hHold = holdoutRun({}, "buy_and_hold");
    const hWalk: Segment = {
      pnl: walk.reduce((s, f) => s + f.pnl, 0),
      sharpe: segmentSharpe([INITIAL_BALANCE, ...walkEquity], 1, walkEquity.length + 1),
      equity: walkEquity,
    };
    const observed = scores[peak]!;
    const pValue = (1 + noiseMax.filter((v) => v >= observed).length) / (noiseMax.length + 1);

    post({
      type: "done", grid: full, peak, plateau, walk, holdout: { peak: hPeak, plateau: hPlateau, walk: hWalk, hold: hHold },
      noiseMax, pValue, evals, ms: Math.round(performance.now() - t0),
    });
  } catch (e) {
    post({ type: "error", message: (e as Error).message });
  }
};
