import { NextResponse } from "next/server";
import type { PokerCalculations } from "poker-calculations";
import { bad, engineUnavailable, loadNative } from "@/app/(poker)/api/poker/engine";
import { canonicalizeHand } from "@/app/(poker)/poker";
import { cellOf, classCombos, classLabel } from "@/app/(poker)/handMatrix";
import { actionEvs, nearestFlips, robustChoice, type Policy, type Sizes, type VillainCombo } from "@/app/(poker)/riverModel";

/* Geometry of Decisions — the river surface.

   POST { board: string[5], range: number[169] (villain's arriving range, class
          weights 0..1 in matrix order), pot, bet, raiseTo,
          policy: { valueFrac, bluffFreq, foldToRaise },
          focus?: 0..168, band?: number, surface?: boolean (default true) }
   ->   { cells: per hero class { evFold, evCall, evRaise, best, margin, combos, split }[169] | null,
          focus: { label, combos: [{ cards, category, evs, flips, robust }] } | null,
          sizes, policy, meta }

   Showdown truth comes from the engine: every live two-card combo on this
   board is scored once by evaluateBestHand and turned into a total order
   (category, then kickers). Everything after that is the explicit game in
   riverModel.ts — card removal is exact (villain combos sharing a card with
   the board or with hero's combo are excluded) and every number can be
   recomputed by hand from the payoff table. Scoring is memoised per board. */

export const runtime = "nodejs";

const RANKS = "23456789TJQKA";
const SUITS = "cdhs";
const CATEGORY = ["highCard", "onePair", "twoPair", "threeOfAKind", "straight", "flush", "fullHouse", "fourOfAKind", "straightFlush", "royalFlush"];

/** Total order over 7-card hands from the engine's {rank, kickers}: category first, then kickers high to low. */
function score(r: { rank: string; kickers: number[] }): number {
  let s = CATEGORY.indexOf(r.rank);
  if (s < 0) throw new Error(`unknown hand category from engine: ${r.rank}`);
  for (let i = 0; i < 5; i++) s = s * 16 + (r.kickers[i] ?? 0);
  return s;
}

type Universe = {
  combos: [string, string][];   // every live two-card combo on this board
  strength: number[];           // engine score per combo
  index: Map<string, number>;   // "AhKd" and "KdAh" -> combo index
};

const universes = new Map<string, Universe>();

function universeFor(board: string[], engine: PokerCalculations): Universe {
  const key = [...board].sort().join(",");
  const hit = universes.get(key);
  if (hit) return hit;
  const dead = new Set(board);
  const cards: string[] = [];
  for (const r of RANKS) for (const s of SUITS) if (!dead.has(r + s)) cards.push(r + s);
  const combos: [string, string][] = [];
  const strength: number[] = [];
  const index = new Map<string, number>();
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i]!, b = cards[j]!;
      index.set(a + b, combos.length);
      index.set(b + a, combos.length);
      combos.push([a, b]);
      strength.push(score(engine.evaluateBestHand([a, b, ...board])));
    }
  }
  const u = { combos, strength, index };
  universes.set(key, u);
  if (universes.size > 64) universes.delete(universes.keys().next().value as string);
  return u;
}

const num = (v: unknown, lo: number, hi: number, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return bad("Invalid JSON body."); }

  const rawBoard = body.board;
  if (!Array.isArray(rawBoard) || rawBoard.length !== 5 || !rawBoard.every((c) => typeof c === "string")) return bad("board must be 5 card codes.");
  let board: string[];
  try { board = canonicalizeHand(rawBoard as string[]); } catch (e) { return bad((e as Error).message); }

  const range = body.range;
  if (!Array.isArray(range) || range.length !== 169 || !range.every((w) => typeof w === "number")) return bad("range must be 169 class weights.");
  const rangeW = (range as number[]).map((w) => Math.min(1, Math.max(0, w)));
  if (rangeW.every((w) => w === 0)) return bad("villain range is empty.");

  const sizes: Sizes = { pot: num(body.pot, 1, 1e6, 100), bet: num(body.bet, 0.01, 1e6, 50), raiseTo: 0 };
  sizes.raiseTo = num(body.raiseTo, sizes.bet * 2, 1e7, sizes.bet * 3);
  const p = (body.policy ?? {}) as Record<string, unknown>;
  const policy: Policy = { valueFrac: num(p.valueFrac, 0, 1, 0.35), bluffFreq: num(p.bluffFreq, 0, 1, 0.35), foldToRaise: num(p.foldToRaise, 0, 1, 0.2) };
  const focus = typeof body.focus === "number" && Number.isInteger(body.focus) && body.focus >= 0 && body.focus < 169 ? body.focus : null;
  const band = num(body.band, 0.02, 0.5, 0.15);
  const wantSurface = body.surface !== false;

  const engine = await loadNative();
  if (!engine) return engineUnavailable();

  const t0 = performance.now();
  const U = universeFor(board, engine);

  // villain's arriving range, per combo (class weight), before hero's blockers
  const arriving = new Float64Array(U.combos.length);
  for (let k = 0; k < 169; k++) {
    const w = rangeW[k]!;
    if (w <= 0) continue;
    const { i, j } = cellOf(k);
    for (const [a, b] of classCombos(i, j)) {
      const idx = U.index.get(a + b);
      if (idx !== undefined) arriving[idx] = w;
    }
  }
  // villain combos ascending by strength, once per request
  const order = Array.from(U.combos.keys()).filter((idx) => arriving[idx]! > 0).sort((x, y) => U.strength[x]! - U.strength[y]!);

  /** Villain's arriving combos that do not share a card with hero's combo — still ascending. */
  const villainsFor = (heroIdx: number): VillainCombo[] => {
    const [ha, hb] = U.combos[heroIdx]!;
    const out: VillainCombo[] = [];
    for (const idx of order) {
      const [va, vb] = U.combos[idx]!;
      if (va === ha || va === hb || vb === ha || vb === hb) continue;
      out.push({ strength: U.strength[idx]!, weight: arriving[idx]! });
    }
    return out;
  };
  const heroesOf = (k: number) => {
    const { i, j } = cellOf(k);
    return classCombos(i, j)
      .map(([a, b]) => ({ cards: [a, b] as [string, string], idx: U.index.get(a + b) }))
      .filter((x): x is { cards: [string, string]; idx: number } => x.idx !== undefined);
  };

  let cells: unknown[] | null = null;
  if (wantSurface) {
    cells = new Array(169);
    for (let k = 0; k < 169; k++) {
      const heroes = heroesOf(k);
      if (heroes.length === 0) { cells[k] = null; continue; }
      let evFold = 0, evCall = 0, evRaise = 0, margin = 0;
      const split = { fold: 0, call: 0, raise: 0 };
      for (const h of heroes) {
        const e = actionEvs(U.strength[h.idx]!, villainsFor(h.idx), policy, sizes);
        evFold += e.evFold; evCall += e.evCall; evRaise += e.evRaise; margin += e.margin; split[e.best]++;
      }
      const n = heroes.length;
      const evs = { fold: evFold / n, call: evCall / n, raise: evRaise / n };
      const best = (Object.keys(evs) as (keyof typeof evs)[]).sort((a, b) => evs[b] - evs[a])[0]!;
      const { i, j } = cellOf(k);
      cells[k] = { label: classLabel(i, j), evFold: evs.fold, evCall: evs.call, evRaise: evs.raise, best, margin: margin / n, combos: n, split };
    }
  }

  let focusOut: unknown = null;
  if (focus !== null) {
    const { i, j } = cellOf(focus);
    const combos = heroesOf(focus).map((h) => {
      const villains = villainsFor(h.idx);
      const hs = U.strength[h.idx]!;
      return {
        cards: h.cards,
        category: CATEGORY[Math.floor(hs / 16 ** 5)] ?? "?",
        evs: actionEvs(hs, villains, policy, sizes),
        flips: nearestFlips(hs, villains, policy, sizes),
        robust: robustChoice(hs, villains, policy, sizes, band),
      };
    });
    focusOut = { label: classLabel(i, j), combos };
  }

  return NextResponse.json({
    board, sizes, policy, cells, focus: focusOut,
    meta: { engine: "poker-calculations (C++, N-API)", liveCombos: U.combos.length, villainCombos: order.length, ms: Math.round(performance.now() - t0) },
  });
}
