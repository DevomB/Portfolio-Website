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
  type Cell, type CellScore, type MirageDone, type MirageMessage, type MirageStart, type Phase, type Segment, type WalkFold,
} from "./worlds";

let arena: PallasArena | null = null;
let stop = false;
const post = (m: MirageMessage) => (self as unknown as Worker).postMessage(m);
const checkStop = () => { if (stop) throw new Error("stopped"); };

/** One experiment: the world, the grid, and everything the passes fill in. */
type Experiment = {
  arena: PallasArena;
  msg: MirageStart;
  closes: number[];
  cells: Cell[];
  t0: number;
  evals: number;
  grid: (CellScore | null)[];
  walk: WalkFold[];
  noiseMax: number[];
  lastPost: number;
};

function experiment(arena: PallasArena, msg: MirageStart): Experiment {
  const closes = makeWorld(msg.seed, msg.kind, msg.strength);
  const cells = gridCells(msg.family);
  return { arena, msg, closes, cells, t0: performance.now(), evals: 0, grid: new Array(cells.length).fill(null), walk: [], noiseMax: [], lastPost: 0 };
}

const score = (x: Experiment, s: CellScore) => (x.msg.metric === "pnl" ? s.pnl : s.sharpe);

/** One backtest on the real engine. */
function run(x: Experiment, tape: number[], params: ArenaParams, strategy: ArenaStrategy = x.msg.family) {
  const r = x.arena.run(toCsv(tape), strategy, { ...params, qty: x.msg.qty }, INITIAL_BALANCE);
  x.evals++;
  return { equity: r.equity_curve.map((p) => Number.parseFloat(p.equity_quote)), trades: r.closed_trades };
}

/** A whole tape, scored. */
function scoreRun(x: Experiment, tape: number[], params: ArenaParams): CellScore {
  const { equity, trades } = run(x, tape, params);
  return { pnl: segmentPnl(equity, 0, tape.length), sharpe: segmentSharpe(equity, 0, tape.length), trades };
}

/** Post progress: throttled while the sweep paints cells, always on a pass's last step. */
function progress(x: Experiment, phase: Phase, done: number, total: number): void {
  const now = performance.now();
  const force = phase !== "sweep" || done === total;
  if (!force && now - x.lastPost < 60) return;
  x.lastPost = now;
  post({ type: "progress", phase, done, total, grid: x.grid.slice(), walk: x.walk.slice(), noiseMax: x.noiseMax.slice(), evals: x.evals, evalsPerSec: x.evals / ((now - x.t0) / 1000) });
}

/** Every cell on the in-sample bars; the peak and the plateau it produces. */
function sweep(x: Experiment): { scores: number[]; peak: number; plateau: number } {
  const isCloses = x.closes.slice(0, IS_BARS);
  for (const c of x.cells) {
    checkStop();
    x.grid[c.index] = scoreRun(x, isCloses, c.params);
    progress(x, "sweep", c.index + 1, x.cells.length);
  }
  const scores = (x.grid as CellScore[]).map((s) => score(x, s));
  return { scores, peak: argmax(scores), plateau: plateauPick(x.msg.family, scores) };
}

/** Four held-out quarters, each re-selecting on the trailing bars; the stitched walk-forward equity. */
function walkForward(x: Experiment): number[] {
  const walkEquity: number[] = [];
  let cum = 0;
  for (let k = 0; k < FOLDS.length - 1; k++) {
    checkStop();
    const from = FOLDS[k]!, to = FOLDS[k + 1]!;
    const sel = x.closes.slice(from - WARMUP, from);
    const best = argmax(x.cells.map((c) => score(x, scoreRun(x, sel, c.params))));
    const { equity } = run(x, x.closes.slice(from - WARMUP, to), x.cells[best]!.params);
    const pnl = segmentPnl(equity, WARMUP, equity.length);
    x.walk.push({ fold: k + 1, from, to, pick: best, pnl, sharpe: segmentSharpe(equity, WARMUP, equity.length) });
    for (const e of rebase(equity, WARMUP, equity.length)) walkEquity.push(e + cum);
    cum += pnl;
    progress(x, "walk", k + 1, FOLDS.length - 1);
  }
  return walkEquity;
}

/** The same in-sample returns, shuffled — what does "best of the grid" look like when there is nothing there? */
function noiseTest(x: Experiment): void {
  const isCloses = x.closes.slice(0, IS_BARS);
  const rng = mulberry32((Math.imul(x.msg.seed, 2654435761) + 97) >>> 0);
  for (let m = 0; m < x.msg.permutations; m++) {
    checkStop();
    const w = shuffledCloses(isCloses, rng);
    x.noiseMax.push(Math.max(...x.cells.map((c) => score(x, scoreRun(x, w, c.params)))));
    progress(x, "noise", m + 1, x.msg.permutations);
  }
}

/** A pick through the held-out year (250 bars of warm-up first). */
function holdoutRun(x: Experiment, params: ArenaParams, strategy?: ArenaStrategy): Segment {
  const { equity } = run(x, x.closes.slice(IS_BARS - WARMUP, WORLD_BARS), params, strategy);
  return { pnl: segmentPnl(equity, WARMUP, equity.length), sharpe: segmentSharpe(equity, WARMUP, equity.length), equity: rebase(equity, WARMUP, equity.length) };
}

/** The peak, the plateau, the walk-forward, and buy-and-hold, graded on the held-out year. */
function holdout(x: Experiment, peak: number, plateau: number, walkEquity: number[]): MirageDone["holdout"] {
  const hPeak = holdoutRun(x, x.cells[peak]!.params);
  progress(x, "holdout", 1, 3);
  const hPlateau = holdoutRun(x, x.cells[plateau]!.params);
  progress(x, "holdout", 2, 3);
  // the reference: buy on the first bar of the run, so simply long through the held-out year
  const hold = holdoutRun(x, {}, "buy_and_hold");
  const walk: Segment = {
    pnl: x.walk.reduce((s, f) => s + f.pnl, 0),
    sharpe: segmentSharpe([INITIAL_BALANCE, ...walkEquity], 1, walkEquity.length + 1),
    equity: walkEquity,
  };
  return { peak: hPeak, plateau: hPlateau, walk, hold };
}

self.onmessage = async (ev: MessageEvent<MirageStart | { type: "stop" }>) => {
  const msg = ev.data;
  if (msg.type === "stop") { stop = true; return; }
  stop = false;
  try {
    if (!arena) {
      arena = await PallasArena.load();
      post({ type: "ready" });
    }
    const x = experiment(arena, msg);
    post({ type: "world", closes: x.closes });

    const { scores, peak, plateau } = sweep(x);
    const walkEquity = walkForward(x);
    noiseTest(x);
    const observed = scores[peak]!;
    const pValue = (1 + x.noiseMax.filter((v) => v >= observed).length) / (x.noiseMax.length + 1);

    post({
      type: "done", grid: x.grid as CellScore[], peak, plateau, walk: x.walk, holdout: holdout(x, peak, plateau, walkEquity),
      noiseMax: x.noiseMax, pValue, evals: x.evals, ms: Math.round(performance.now() - x.t0),
    });
  } catch (e) {
    post({ type: "error", message: (e as Error).message });
  }
};
