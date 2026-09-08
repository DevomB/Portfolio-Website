import { NextResponse } from "next/server";
import os from "node:os";
import type { PokerCalculations } from "poker-calculations";
import { bad, engineUnavailable, loadNative, readRange } from "@/app/(poker)/api/poker/engine";
import { canonicalizeHand, mulberry32, simulateEquityMonteCarloJs } from "@/app/(poker)/poker";
import { cellOf, classCombos, classLabel, liveCombos } from "@/app/(poker)/handMatrix";

/* The Landscape: equity for every one of the 169 starting-hand classes on a
   given board, computed by the real poker-calculations engine (C++ via N-API).

   POST { board: string[] (0, 3, 4 or 5 cards),
          villains: 1 | 2 | 3 | "range",
          range?: number[169]   (villain's range as class weights, matrix order — required for "range"),
          iters?: number }
   ->   { equities: (number|null)[169], ... }   null = no live combo on this board

   Two opponents. Against N random hands the engine's threaded Monte Carlo
   runs per class. Against a painted range, heads-up: on the river the
   engine's exact range equity (it removes the combos hero blocks); earlier
   the villain combo and the runout are sampled here by weight and every
   showdown is scored by the engine's batch evaluator. Every class is
   represented by up to two concrete combos spread across suit patterns.
   Seeds derive from the request shape, so the same request always returns
   the same terrain — a deformation on screen is a real change in equity,
   never sampling noise. Responses are memoised in-process. */

export const runtime = "nodejs";

const THREADS = Math.min(16, Math.max(2, os.cpus().length));
const DEFAULT_ITERS = 400;
const MAX_ITERS = 2000;
const RANKS = "23456789TJQKA";
const SUITS = "cdhs";
/** engine deck id: rank * 4 + suit (2..A, c d h s) */
const cardId = (c: string) => RANKS.indexOf(c[0]!) * 4 + SUITS.indexOf(c[1]!);

// FNV-1a — a stable 32-bit seed from the request shape
function seedFor(parts: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Opponent = 1 | 2 | 3 | "range";
type Method = "mc-random" | "mc-range" | "exact-range";

type Result = {
  equities: (number | null)[];
  board: string[];
  villains: Opponent;
  iters: number;
  engine: "native" | "js";
  method: Method;
  threads: number;
  rangeCombos: number | null;
  ms: number;
};

// ── the memo: an LRU of finished terrains ──────────────────────────────────
const cache = new Map<string, Result>();
const CACHE_MAX = 512;

function cached(key: string): Result | undefined {
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); } // a hit moves to the back
  return hit;
}

function remember(key: string, result: Result): void {
  cache.set(key, result);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

// ── the request ────────────────────────────────────────────────────────────
type LandscapeParams = { board: string[]; villains: Opponent; iters: number; weights: number[] | null };

/** Validate the request body: the params, or the 400 to send instead. */
function readParams(body: unknown): LandscapeParams | NextResponse {
  const { board: rawBoard, villains: rawVillains, iters: rawIters, range: rawRange } = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(rawBoard) || !rawBoard.every((c) => typeof c === "string")) return bad("board must be an array of card codes.");
  if (![0, 3, 4, 5].includes(rawBoard.length)) return bad("board must have 0, 3, 4 or 5 cards.");
  let board: string[];
  try { board = canonicalizeHand(rawBoard as string[]); } catch (e) { return bad((e as Error).message); }

  const villains: Opponent = rawVillains === "range" ? "range" : typeof rawVillains === "number" && [1, 2, 3].includes(rawVillains) ? (rawVillains as 1 | 2 | 3) : 1;
  const iters = typeof rawIters === "number" && Number.isFinite(rawIters) ? Math.min(MAX_ITERS, Math.max(100, Math.floor(rawIters))) : DEFAULT_ITERS;
  let weights: number[] | null = null;
  if (villains === "range") {
    const r = readRange(rawRange);
    if (r instanceof NextResponse) return r;
    weights = r;
  }
  return { board, villains, iters, weights };
}

// ── against a painted range, before the river: sampled showdowns ───────────
type Combo = { a: number; b: number; w: number };

/** Villain's range as concrete combos with weights, minus the board. */
function rangeCombosOf(weights: number[], board: string[]): Combo[] {
  const dead = new Set(board.map(cardId));
  const out: Combo[] = [];
  for (let k = 0; k < 169; k++) {
    const w = weights[k]!;
    if (w <= 0) continue;
    const { i, j } = cellOf(k);
    for (const [x, y] of classCombos(i, j)) {
      const a = cardId(x), b = cardId(y);
      if (dead.has(a) || dead.has(b)) continue;
      out.push({ a, b, w });
    }
  }
  return out;
}

/** What one estimate against the range needs besides the hero. */
type RangeSim = { native: PokerCalculations; boardIds: number[]; villains: Combo[]; sims: number };
type Showdowns = { holesH: Uint8Array; holesV: Uint8Array; boards: Uint8Array };

/** Index of the first cumulative weight at or above `u` (binary search). */
function pickByWeight(cum: Float64Array, u: number): number {
  let lo = 0, hi = cum.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid]! < u) lo = mid + 1; else hi = mid; }
  return lo;
}

/** `need` board cards drawn without replacement from the pool, never villain's two. */
function runout(pool: number[], need: number, v: Combo, rng: () => number): number[] {
  const out: number[] = [];
  for (let t = 0; out.length < need; t++) {
    const idx = t + Math.floor(rng() * (pool.length - t));
    const c = pool[idx]!; pool[idx] = pool[t]!; pool[t] = c;
    if (c !== v.a && c !== v.b) out.push(c);
  }
  return out;
}

/** Sample the showdowns: the villain combo by weight (never sharing a card
    with hero), the runout without replacement. Null when hero blocks the
    whole range. */
function sampleShowdowns(sim: RangeSim, hero: [number, number], rng: () => number): Showdowns | null {
  const [heroA, heroB] = hero;
  const live = sim.villains.filter((v) => v.a !== heroA && v.a !== heroB && v.b !== heroA && v.b !== heroB);
  if (live.length === 0) return null;
  const cum = new Float64Array(live.length);
  let total = 0;
  for (let i = 0; i < live.length; i++) { total += live[i]!.w; cum[i] = total; }

  const { sims, boardIds } = sim;
  const holesH = new Uint8Array(2 * sims), holesV = new Uint8Array(2 * sims), boards = new Uint8Array(5 * sims);
  const known = new Set([heroA, heroB, ...boardIds]);
  const pool: number[] = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) pool.push(c);
  for (let s = 0; s < sims; s++) {
    const v = live[pickByWeight(cum, rng() * total)]!;
    holesH[2 * s] = heroA; holesH[2 * s + 1] = heroB;
    holesV[2 * s] = v.a; holesV[2 * s + 1] = v.b;
    boards.set(boardIds, 5 * s);
    boards.set(runout(pool, 5 - boardIds.length, v, rng), 5 * s + boardIds.length);
  }
  return { holesH, holesV, boards };
}

/** Monte Carlo equity of one hero combo against the weighted range, every
    showdown scored by the engine's batch evaluator. Deterministic per seed.
    NaN when hero blocks the whole range. */
function mcVsRange(sim: RangeSim, hero: [number, number], seed: number): number {
  const s = sampleShowdowns(sim, hero, mulberry32(seed));
  if (!s) return NaN;
  const sh = sim.native.evaluateHandStrengthFastBatch(s.holesH, s.boards, 5);
  const sv = sim.native.evaluateHandStrengthFastBatch(s.holesV, s.boards, 5);
  let eq = 0;
  for (let i = 0; i < sim.sims; i++) eq += sh[i]! > sv[i]! ? 1 : sh[i] === sv[i] ? 0.5 : 0;
  return eq / sim.sims;
}

// ── one request, 169 classes ───────────────────────────────────────────────
/** Everything the per-class estimates share for one request. */
type Run = {
  p: LandscapeParams;
  key: string;
  native: PokerCalculations | null;
  boardIds: number[];
  combos: Combo[] | null;
  dense: ReturnType<PokerCalculations["rangeFromNotationWeights"]> | null;
  method: Method;
};

/** Equity of one concrete hero combo by whichever method the request calls for. */
function heroEquity(run: Run, hero: [string, string], seed: number, per: number): number {
  const { p, native } = run;
  if (p.villains === "range") {
    return run.dense
      ? native!.exactHuEquityVsRange(hero, p.board, run.dense)
      : mcVsRange({ native: native!, boardIds: run.boardIds, villains: run.combos!, sims: p.iters }, [cardId(hero[0]), cardId(hero[1])], seed);
  }
  return native
    ? native.parallelHandSimulation(hero, p.board, per, seed, p.villains, THREADS)
    : simulateEquityMonteCarloJs(hero, p.board, per, seed); // fallback is heads-up only
}

/** Equity of a class: up to two representatives spread across suit patterns, the budget split between them. */
function classEquity(run: Run, k: number): number | null {
  const { i, j } = cellOf(k);
  const live = liveCombos(i, j, run.p.board);
  if (live.length === 0) return null;
  const reps = live.length > 1 ? [live[0]!, live[Math.floor(live.length / 2)]!] : [live[0]!];
  const per = Math.ceil(run.p.iters / reps.length);
  let acc = 0, n = 0;
  reps.forEach((hero, r) => {
    const e = heroEquity(run, hero, seedFor(`${k}|${r}|${run.key}`), per);
    if (Number.isFinite(e)) { acc += e; n++; }
  });
  return n ? acc / n : null;
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return bad("Invalid JSON body."); }
  const p = readParams(body);
  if (p instanceof NextResponse) return p;

  const key = `${[...p.board].sort().join(",")}|${p.villains}|${p.iters}|${p.weights ? seedFor(p.weights.join(",")) : ""}`;
  const hit = cached(key);
  if (hit) return NextResponse.json({ ...hit, cached: true });

  const native = await loadNative();
  if (!native && p.villains === "range") return engineUnavailable();
  const t0 = performance.now();
  const river = p.board.length === 5;
  const method: Method = p.villains === "range" ? (river ? "exact-range" : "mc-range") : "mc-random";
  const run: Run = {
    p, key, native, method,
    boardIds: p.board.map(cardId),
    combos: p.weights ? rangeCombosOf(p.weights, p.board) : null,
    // the engine's own range for the river: dense weights by notation, blockers handled inside
    dense: p.weights && river && native
      ? native.rangeFromNotationWeights(p.weights.flatMap((w, k) => (w > 0 ? [{ notation: classLabel(cellOf(k).i, cellOf(k).j), weight: w }] : [])))
      : null,
  };

  const result: Result = {
    equities: Array.from({ length: 169 }, (_, k) => classEquity(run, k)),
    board: p.board,
    villains: native ? p.villains : 1,
    iters: p.iters,
    engine: native ? "native" : "js",
    method,
    threads: native && method === "mc-random" ? THREADS : 1,
    rangeCombos: run.combos ? run.combos.length : null,
    ms: Math.round(performance.now() - t0),
  };
  remember(key, result);
  return NextResponse.json({ ...result, cached: false });
}
