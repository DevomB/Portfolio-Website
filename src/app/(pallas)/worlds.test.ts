import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/app/(poker)/poker";
import { logReturns } from "@/app/(pallas)/tape";
import {
  FOLDS, INITIAL_BALANCE, IS_BARS, PHI_MAX, WORLD_BARS, argmax, gridCells, gridShape, makeWorld, neighbours, phiOf,
  plateauPick, rebase, segmentPnl, segmentSharpe, shuffledCloses,
} from "@/app/(pallas)/worlds";

describe("worlds", () => {
  it("plants persistence or reversal, scaled by strength, and nothing in noise", () => {
    expect(phiOf("noise", 1)).toBe(0);
    expect(phiOf("trend", 1)).toBe(PHI_MAX);
    expect(phiOf("reversion", 0.5)).toBe(-PHI_MAX / 2);
    expect(phiOf("trend", 7)).toBe(PHI_MAX); // strength is clamped
  });

  it("makes a seeded 750-bar tape and the held-out year starts where folds say", () => {
    const w = makeWorld(1, "trend", 0.5);
    expect(w).toHaveLength(WORLD_BARS);
    expect(w[0]).toBe(100);
    expect(makeWorld(1, "trend", 0.5)).toEqual(w);
    expect(makeWorld(2, "trend", 0.5)).not.toEqual(w);
    expect(FOLDS[0]).toBe(IS_BARS);
    expect(FOLDS[FOLDS.length - 1]).toBe(WORLD_BARS);
  });

  it("a planted trend makes consecutive returns correlate", () => {
    const corr = (xs: number[]) => {
      const a = xs.slice(0, -1), b = xs.slice(1);
      const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < a.length; i++) { num += (a[i]! - ma) * (b[i]! - mb); da += (a[i]! - ma) ** 2; db += (b[i]! - mb) ** 2; }
      return num / Math.sqrt(da * db);
    };
    expect(corr(logReturns(makeWorld(5, "trend", 1, 5000)))).toBeGreaterThan(0.25);
    expect(corr(logReturns(makeWorld(5, "reversion", 1, 5000)))).toBeLessThan(-0.25);
    expect(Math.abs(corr(logReturns(makeWorld(5, "noise", 1, 5000))))).toBeLessThan(0.08);
  });

  it("shuffling keeps the start, the set of returns, and therefore the end", () => {
    const w = makeWorld(9, "trend", 1, 120);
    const s = shuffledCloses(w, mulberry32(3));
    expect(s).toHaveLength(w.length);
    expect(s[0]).toBe(w[0]);
    expect(s[s.length - 1]).toBeCloseTo(w[w.length - 1]!, 6);
    const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
    const a = sorted(logReturns(w)), b = sorted(logReturns(s));
    for (let i = 0; i < a.length; i++) expect(b[i]).toBeCloseTo(a[i]!, 9);
  });
});

describe("grids", () => {
  it("lays every family out as a grid of real parameter sets", () => {
    expect(gridShape("sma_cross")).toEqual({ nx: 8, ny: 8 });
    expect(gridShape("momentum")).toEqual({ nx: 12, ny: 1 });
    const cells = gridCells("sma_cross");
    expect(cells).toHaveLength(64);
    expect(cells.map((c) => c.index)).toEqual(cells.map((_, i) => i));
    for (const c of cells) expect(c.params.fast!).toBeLessThan(c.params.slow!);
    expect(gridCells("momentum")[3]!.label).toBe("lookback 8");
    expect(gridCells("mean_revert")[9]!.params).toEqual({ lookback: 10, z_entry: 0.75 });
  });

  it("neighbourhoods are 8-connected and clipped at the edges", () => {
    expect(neighbours("sma_cross", 0)).toHaveLength(4);
    expect(neighbours("sma_cross", 9)).toHaveLength(9);
    expect(neighbours("momentum", 5)).toEqual([4, 5, 6]);
    expect(neighbours("momentum", 0)).toEqual([0, 1]);
  });

  it("the plateau pick prefers a broad hill to a lone spike", () => {
    const scores = new Array(64).fill(0);
    scores[0] = 100; // a spike in the corner
    for (const j of neighbours("sma_cross", 27)) scores[j] = 30; // a hill in the middle
    expect(argmax(scores)).toBe(0);
    expect(plateauPick("sma_cross", scores)).toBe(27);
  });
});

describe("scores off an equity curve", () => {
  const equity = [10_100, 10_200, 10_100, 10_400];

  it("P&L and rebasing read the curve over a window", () => {
    expect(segmentPnl(equity, 0, 4)).toBe(400);
    expect(segmentPnl(equity, 2, 4)).toBe(200); // from the bar before the window
    expect(rebase(equity, 2, 4)).toEqual([INITIAL_BALANCE - 100, INITIAL_BALANCE + 200]);
  });

  it("Sharpe is annualised, zero without variance or with fewer than two returns", () => {
    expect(segmentSharpe([10_100, 10_201], 0, 2)).toBe(0); // flat return series → no variance
    expect(segmentSharpe(equity, 3, 4)).toBe(0);
    expect(segmentSharpe(equity, 0, 4)).toBeGreaterThan(0);
    expect(segmentSharpe([9_900, 9_800, 9_950, 9_700], 0, 4)).toBeLessThan(0);
  });
});
