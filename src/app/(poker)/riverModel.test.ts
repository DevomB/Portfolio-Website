import { describe, expect, it } from "vitest";
import { actionEvs, bettingRange, nearestFlips, robustChoice, type Policy, type Sizes, type VillainCombo } from "@/app/(poker)/riverModel";

/* Two villain combos, one hero: small enough to check every number by hand
   against the payoff table at the top of riverModel.ts. */
const villains: VillainCombo[] = [
  { strength: 1, weight: 1 }, // hero beats this one
  { strength: 3, weight: 1 }, // this one beats hero
];
const hero = 2;
const sizes: Sizes = { pot: 100, bet: 50, raiseTo: 150 };
/* villain value-bets its strongest half (strength 3) and bluffs everything
   left (strength 1); value never folds to a raise, bluffs always do */
const policy: Policy = { valueFrac: 0.5, bluffFreq: 1, foldToRaise: 0 };

describe("bettingRange", () => {
  it("bets the strongest valueFrac by weight and bluffs the weakest of the rest", () => {
    const { bet, fold } = bettingRange(villains, policy);
    expect(bet).toEqual([1, 1]);
    expect(fold).toEqual([1, 0]); // the bluff folds to a raise, the value hand does not
  });

  it("checks (bets nothing) when both dials are zero", () => {
    const { bet } = bettingRange(villains, { valueFrac: 0, bluffFreq: 0, foldToRaise: 0 });
    expect(bet).toEqual([0, 0]);
  });
});

describe("actionEvs", () => {
  it("matches the payoff table", () => {
    const e = actionEvs(hero, villains, policy, sizes);
    // call: win P+B against the bluff, lose B to the value hand, each half the time
    expect(e.evCall).toBeCloseTo((150 - 50) / 2, 10);
    // raise: the bluff folds (+P+B), the value hand calls and wins (−R)
    expect(e.evRaise).toBeCloseTo((150 - 150) / 2, 10);
    expect(e.evFold).toBe(0);
    expect(e.best).toBe("call");
    expect(e.margin).toBeCloseTo(50, 10);
    expect(e.pWin).toBe(0.5);
    expect(e.pTie).toBe(0);
    expect(e.pFoldToRaise).toBe(0.5);
    expect(e.pWinIfCalled).toBe(0); // only the value hand calls, and it wins
    expect(e.bettingWeight).toBe(2);
  });

  it("folds when villain never bets", () => {
    const e = actionEvs(hero, villains, { valueFrac: 0, bluffFreq: 0, foldToRaise: 0 }, sizes);
    expect(e.best).toBe("fold");
    expect(e.bettingWeight).toBe(0);
  });

  it("raises when the value hand folds often enough", () => {
    const e = actionEvs(hero, villains, { ...policy, foldToRaise: 1 }, sizes);
    expect(e.evRaise).toBeCloseTo(150, 10); // everything folds: +(P+B) every time
    expect(e.best).toBe("raise");
  });
});

describe("sensitivity", () => {
  it("finds the nearest fold-to-raise at which raising overtakes calling", () => {
    const flips = nearestFlips(hero, villains, policy, sizes);
    const f = flips.find((x) => x.param === "foldToRaise")!;
    expect(f).toBeDefined();
    expect(f.newBest).toBe("raise");
    // raise EV = ½(150) + ½(f·150 − (1−f)·150) = 75 + 150f − 75 = 150f; call EV = 50 → flips past f = 1/3
    expect(f.to).toBeGreaterThan(1 / 3);
    expect(f.to).toBeLessThanOrEqual(0.36);
    expect([...flips]).toEqual([...flips].sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from)));
  });

  it("robustChoice reports the worst case of each action across the band", () => {
    const r = robustChoice(hero, villains, policy, sizes, 0.15, 5);
    expect(r.band).toBe(0.15);
    expect(r.exploitative).toBe("call");
    expect(r.worstCase.fold).toBe(0);
    expect(r.worstCase.call).toBeLessThanOrEqual(actionEvs(hero, villains, policy, sizes).evCall);
    expect(["fold", "call", "raise"]).toContain(r.robust);
  });
});
