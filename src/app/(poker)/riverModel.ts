/* Geometry of Decisions — the river game, stated explicitly.

   Heads-up. It is the river. Villain has bet B into a pot of P. Hero holds
   one concrete combo and may FOLD, CALL, or RAISE to R (hero's total stake).

   Villain is modelled, not solved. The painted range is the set of combos
   villain can arrive at the river with. Villain's policy has three dials:
     valueFrac    — villain bets the strongest `valueFrac` share (by weight)
                    of the arriving range for value;
     bluffFreq    — of the remaining, non-value share, villain bets the
                    weakest `bluffFreq` share as bluffs (polarised: bluffs
                    are the hands with the least showdown value);
     foldToRaise  — probability a VALUE bet folds to hero's raise. Bluffs
                    always fold to a raise.
   Combos that neither value-bet nor bluff check, so — given that villain
   has bet — they are excluded. All probabilities are conditional on the
   bet. Every showdown outcome comes from the engine's strength evaluator;
   this file only does the bookkeeping, so each number can be checked by
   hand against the payoffs below.

   Payoffs (hero's net chips, per outcome):
     fold                                   0
     call, win / tie / lose                 +(P+B) / +P/2 / −B
     raise, villain folds                   +(P+B)
     raise, villain calls, win / tie / lose +(P+R) / +P/2 / −R
       (pot after the call is P+2R; hero's stake is R) */

import { clamp01 } from "@/lib/num";

export type Policy = { valueFrac: number; bluffFreq: number; foldToRaise: number };
export type Sizes = { pot: number; bet: number; raiseTo: number };

export type VillainCombo = { strength: number; weight: number };

/** Hero's combo at the table: its strength, villain's arriving combos that do
    not share a card with it (ascending by strength), and the money. */
export type Spot = { hero: number; villains: VillainCombo[]; sizes: Sizes };

export type ActionEvs = {
  evFold: number;
  evCall: number;
  evRaise: number;
  best: "fold" | "call" | "raise";
  margin: number;          // best minus runner-up
  pWin: number;            // vs the betting range, at showdown
  pTie: number;
  pFoldToRaise: number;    // share of the betting range that folds to a raise
  pWinIfCalled: number;    // P(hero wins | villain calls the raise)
  pTieIfCalled: number;
  bettingWeight: number;   // total weight villain bets with (of the arriving range)
};

/** Villain's betting range under a policy: (weight, foldsToRaise) per combo.
    `sortedAsc` must be ascending by strength; returned in the same order. */
export function bettingRange(sortedAsc: VillainCombo[], policy: Policy): { bet: number[]; fold: number[] } {
  const n = sortedAsc.length;
  const bet = new Array<number>(n).fill(0);
  const fold = new Array<number>(n).fill(0);
  const total = sortedAsc.reduce((s, c) => s + c.weight, 0);
  if (total <= 0) return { bet, fold };

  // value: the strongest valueFrac of the arriving weight, from the top down
  const valueBudget = clamp01(policy.valueFrac) * total;
  let acc = 0;
  let firstValue = n; // index where the value region starts
  for (let i = n - 1; i >= 0 && acc < valueBudget; i--) {
    const w = sortedAsc[i]!.weight;
    const take = Math.min(w, valueBudget - acc);
    bet[i] = take;
    fold[i] = clamp01(policy.foldToRaise);
    acc += take;
    firstValue = i;
  }
  // bluffs: the weakest bluffFreq share of what is left, from the bottom up
  const rest = total - acc;
  const bluffBudget = clamp01(policy.bluffFreq) * rest;
  acc = 0;
  for (let i = 0; i < firstValue && acc < bluffBudget; i++) {
    const w = sortedAsc[i]!.weight - bet[i]!;
    const take = Math.min(w, bluffBudget - acc);
    bet[i] = bet[i]! + take;
    fold[i] = 1; // bluffs fold to a raise
    acc += take;
  }
  return { bet, fold };
}

/** Hero's action values against the betting range villain's policy produces at this spot. */
export function actionEvs(spot: Spot, policy: Policy): ActionEvs {
  const { hero: heroStrength, villains: sortedAsc } = spot;
  const { pot: P, bet: B, raiseTo: R } = spot.sizes;
  const { bet, fold } = bettingRange(sortedAsc, policy);
  let W = 0, win = 0, tie = 0, foldW = 0, calledW = 0, winC = 0, tieC = 0;
  let evCall = 0, evRaise = 0;
  for (let i = 0; i < sortedAsc.length; i++) {
    const w = bet[i]!;
    if (w <= 0) continue;
    W += w;
    const s = sortedAsc[i]!.strength;
    const heroWins = heroStrength > s, tied = heroStrength === s;
    if (heroWins) win += w; else if (tied) tie += w;
    const showCall = heroWins ? P + B : tied ? P / 2 : -B;
    const showRaise = heroWins ? P + R : tied ? P / 2 : -R;
    const f = fold[i]!;
    foldW += w * f;
    const called = w * (1 - f);
    calledW += called;
    if (heroWins) winC += called; else if (tied) tieC += called;
    evCall += w * showCall;
    evRaise += w * (f * (P + B) + (1 - f) * showRaise);
  }
  if (W <= 0) {
    return { evFold: 0, evCall: 0, evRaise: 0, best: "fold", margin: 0, pWin: 0, pTie: 0, pFoldToRaise: 0, pWinIfCalled: 0, pTieIfCalled: 0, bettingWeight: 0 };
  }
  evCall /= W; evRaise /= W;
  const evs = { fold: 0, call: evCall, raise: evRaise };
  const order = (Object.keys(evs) as (keyof typeof evs)[]).sort((a, b) => evs[b] - evs[a]);
  return {
    evFold: 0, evCall, evRaise,
    best: order[0]!, margin: evs[order[0]!] - evs[order[1]!],
    pWin: win / W, pTie: tie / W, pFoldToRaise: foldW / W,
    pWinIfCalled: calledW > 0 ? winC / calledW : 0, pTieIfCalled: calledW > 0 ? tieC / calledW : 0,
    bettingWeight: W,
  };
}

export type Flip = { param: keyof Policy; from: number; to: number; newBest: ActionEvs["best"] };

/** "How wrong can my read be?" — for each policy dial, the nearest value at which
    the preferred action changes. Scanned on a fine grid in both directions. */
export function nearestFlips(spot: Spot, policy: Policy, steps = 100): Flip[] {
  const base = actionEvs(spot, policy).best;
  const out: Flip[] = [];
  for (const param of ["valueFrac", "bluffFreq", "foldToRaise"] as const) {
    let nearest: Flip | null = null;
    for (let k = 0; k <= steps; k++) {
      const v = k / steps;
      const b = actionEvs(spot, { ...policy, [param]: v }).best;
      if (b !== base) {
        const d = Math.abs(v - policy[param]);
        if (!nearest || d < Math.abs(nearest.to - policy[param])) nearest = { param, from: policy[param], to: v, newBest: b };
      }
    }
    if (nearest) out.push(nearest);
  }
  return out.sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from));
}

export type Robust = {
  band: number;
  exploitative: ActionEvs["best"];
  robust: ActionEvs["best"];
  worstCase: Record<ActionEvs["best"], number>; // min EV of each action across the band
};

/** Compare the action that is best at the stated read with the action whose
    WORST case across a ±band on every dial is best (maximin). */
export function robustChoice(spot: Spot, policy: Policy, band = 0.15, grid = 5): Robust {
  const worst: Record<ActionEvs["best"], number> = { fold: 0, call: Infinity, raise: Infinity };
  const axis = (c: number) => Array.from({ length: grid }, (_, i) => clamp01(c - band + (2 * band * i) / (grid - 1)));
  for (const v of axis(policy.valueFrac))
    for (const b of axis(policy.bluffFreq))
      for (const f of axis(policy.foldToRaise)) {
        const e = actionEvs(spot, { valueFrac: v, bluffFreq: b, foldToRaise: f });
        worst.call = Math.min(worst.call, e.evCall);
        worst.raise = Math.min(worst.raise, e.evRaise);
      }
  const exploitative = actionEvs(spot, policy).best;
  const robust = (Object.keys(worst) as ActionEvs["best"][]).sort((a, b) => worst[b] - worst[a])[0]!;
  return { band, exploitative, robust, worstCase: worst };
}
