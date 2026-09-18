import { describe, expect, it } from "vitest";
import { axisTicks, money, sharpeFmt } from "@/app/(pallas)/format";

describe("formatting", () => {
  it("writes signed whole dollars with a true minus sign", () => {
    expect(money(1240.6)).toBe("+$1,241");
    expect(money(-310)).toBe("−$310");
    expect(money(0)).toBe("$0");
  });

  it("writes Sharpe to two places, signed only when positive", () => {
    expect(sharpeFmt(1.2)).toBe("+1.20");
    expect(sharpeFmt(-0.351)).toBe("-0.35");
    expect(sharpeFmt(0)).toBe("0.00");
  });
});

describe("axis ticks", () => {
  const dollars = (v: number) => "$" + Math.round(v).toLocaleString("en-US");

  it("steps 1-2-2.5-5, never finer than a quarter of the span", () => {
    expect(axisTicks(9_800, 10_900, dollars)).toEqual([10_000, 10_500]);
    expect(axisTicks(0, 100, String)).toEqual([0, 25, 50, 75, 100]);
  });

  it("never writes the same label twice", () => {
    // the empty-chart case that read "$1 $1 $1 $0"
    const ticks = axisTicks(0, 1, dollars);
    expect(new Set(ticks.map(dollars)).size).toBe(ticks.length);
    const flatish = axisTicks(10_000, 10_000.4, dollars);
    expect(flatish.map(dollars)).toEqual(["$10,000"]);
  });

  it("gives a flat series one line", () => {
    expect(axisTicks(5, 5, dollars)).toEqual([5]);
  });
});
