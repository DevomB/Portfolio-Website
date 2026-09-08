import { NextResponse } from "next/server";
import os from "node:os";
import type { PokerCalculations } from "poker-calculations";
import { bad, engineUnavailable, loadNative } from "@/app/(poker)/api/poker/engine";
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

const cache = new Map<string, Result>();
const CACHE_MAX = 512;

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

/** Monte Carlo equity of one hero combo against a weighted range. The villain
    combo (by weight, never sharing a card with hero) and the runout are
    sampled here; every showdown is scored by the engine's batch evaluator.
    Deterministic per seed. NaN when hero blocks the whole range. */
function mcVsRange(
  native: PokerCalculations,
  heroA: number,
  heroB: number,
  boardIds: number[],
  villains: Combo[],
  sims: number,
  seed: number,
): number {
  const live = villains.filter((v) => v.a !== heroA && v.a !== heroB && v.b !== heroA && v.b !== heroB);
  if (live.length === 0) return NaN;
  const cum = new Float64Array(live.length);
  let total = 0;
  for (let i = 0; i < live.length; i++) { total += live[i]!.w; cum[i] = total; }
  const rng = mulberry32(seed);
  const holesH = new Uint8Array(2 * sims), holesV = new Uint8Array(2 * sims), boards = new Uint8Array(5 * sims);
  const known = new Set([heroA, heroB, ...boardIds]);
  const pool: number[] = [];
  for (let c = 0; c < 52; c++) if (!known.has(c)) pool.push(c);
  for (let s = 0; s < sims; s++) {
    // villain combo by cumulative weight
    const u = rng() * total;
    let lo = 0, hi = live.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid]! < u) lo = mid + 1; else hi = mid; }
    const v = live[lo]!;
    holesH[2 * s] = heroA; holesH[2 * s + 1] = heroB;
    holesV[2 * s] = v.a; holesV[2 * s + 1] = v.b;
    for (let k = 0; k < boardIds.length; k++) boards[5 * s + k] = boardIds[k]!;
    // runout: draw without replacement from the pool, skipping villain's two cards
    let filled = boardIds.length;
    for (let t = 0; filled < 5; t++) {
      const idx = t + Math.floor(rng() * (pool.length - t));
      const c = pool[idx]!; pool[idx] = pool[t]!; pool[t] = c;
      if (c === v.a || c === v.b) continue;
      boards[5 * s + filled] = c; filled++;
    }
  }
  const sh = native.evaluateHandStrengthFastBatch(holesH, boards, 5);
  const sv = native.evaluateHandStrengthFastBatch(holesV, boards, 5);
  let eq = 0;
  for (let s = 0; s < sims; s++) eq += sh[s]! > sv[s]! ? 1 : sh[s] === sv[s] ? 0.5 : 0;
  return eq / sims;
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return bad("Invalid JSON body."); }
  const { board: rawBoard, villains: rawVillains, iters: rawIters, range: rawRange } = (body ?? {}) as Record<string, unknown>;

  if (!Array.isArray(rawBoard) || !rawBoard.every((c) => typeof c === "string")) return bad("board must be an array of card codes.");
  if (![0, 3, 4, 5].includes(rawBoard.length)) return bad("board must have 0, 3, 4 or 5 cards.");
  let board: string[];
  try { board = canonicalizeHand(rawBoard as string[]); } catch (e) { return bad((e as Error).message); }

  const villains: Opponent = rawVillains === "range" ? "range" : typeof rawVillains === "number" && [1, 2, 3].includes(rawVillains) ? (rawVillains as 1 | 2 | 3) : 1;
  const iters = typeof rawIters === "number" && Number.isFinite(rawIters) ? Math.min(MAX_ITERS, Math.max(100, Math.floor(rawIters))) : DEFAULT_ITERS;

  let weights: number[] | null = null;
  if (villains === "range") {
    if (!Array.isArray(rawRange) || rawRange.length !== 169 || !rawRange.every((w) => typeof w === "number")) return bad("range must be 169 class weights.");
    weights = (rawRange as number[]).map((w) => Math.min(1, Math.max(0, w)));
    if (weights.every((w) => w === 0)) return bad("villain range is empty.");
  }

  const key = `${[...board].sort().join(",")}|${villains}|${iters}|${weights ? seedFor(weights.join(",")) : ""}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return NextResponse.json({ ...hit, cached: true });
  }

  const native = await loadNative();
  if (!native && villains === "range") return engineUnavailable();
  const t0 = performance.now();
  const equities: (number | null)[] = new Array(169).fill(null);

  const boardIds = board.map(cardId);
  const river = board.length === 5;
  const method: Method = villains === "range" ? (river ? "exact-range" : "mc-range") : "mc-random";
  const combos = weights ? rangeCombosOf(weights, board) : null;
  // the engine's own range for the river: dense weights by notation, blockers handled inside
  const dense = weights && river && native
    ? native.rangeFromNotationWeights(weights.flatMap((w, k) => (w > 0 ? [{ notation: classLabel(cellOf(k).i, cellOf(k).j), weight: w }] : [])))
    : null;

  for (let k = 0; k < 169; k++) {
    const { i, j } = cellOf(k);
    const live = liveCombos(i, j, board);
    if (live.length === 0) continue;
    // two representatives spread across suit patterns, budget split between them
    const reps = live.length > 1 ? [live[0]!, live[Math.floor(live.length / 2)]!] : [live[0]!];
    const per = Math.ceil(iters / reps.length);
    let acc = 0, n = 0;
    for (let r = 0; r < reps.length; r++) {
      const seed = seedFor(`${k}|${r}|${key}`);
      const hero = reps[r]!;
      let e: number;
      if (villains === "range") {
        e = dense
          ? native!.exactHuEquityVsRange(hero, board, dense)
          : mcVsRange(native!, cardId(hero[0]), cardId(hero[1]), boardIds, combos!, iters, seed);
      } else {
        e = native
          ? native.parallelHandSimulation(hero, board, per, seed, villains, THREADS)
          : simulateEquityMonteCarloJs(hero, board, per, seed); // fallback is heads-up only
      }
      if (Number.isFinite(e)) { acc += e; n++; }
    }
    equities[k] = n ? acc / n : null;
  }

  const result: Result = {
    equities,
    board,
    villains: native ? villains : 1,
    iters,
    engine: native ? "native" : "js",
    method,
    threads: native && method === "mc-random" ? THREADS : 1,
    rangeCombos: combos ? combos.length : null,
    ms: Math.round(performance.now() - t0),
  };
  cache.set(key, result);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return NextResponse.json({ ...result, cached: false });
}
