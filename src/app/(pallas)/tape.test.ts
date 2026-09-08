import { describe, expect, it } from "vitest";
import { TAPE_LEN, annualisedVol, fromReturns, logReturns, makeTape, toCsv, tradingDates } from "@/app/(pallas)/tape";

describe("tapes", () => {
  it("makes a seeded year of positive closes starting at 100", () => {
    const t = makeTape(7);
    expect(t).toHaveLength(TAPE_LEN);
    expect(t[0]).toBe(100);
    expect(t.every((c) => c > 0)).toBe(true);
    expect(makeTape(7)).toEqual(t);
    expect(makeTape(8)).not.toEqual(t);
    expect(makeTape(7, 30, 50)).toHaveLength(30);
  });

  it("round-trips closes through log returns", () => {
    const t = makeTape(3, 40);
    const back = fromReturns(t[0]!, logReturns(t));
    expect(back).toHaveLength(t.length);
    for (let i = 0; i < t.length; i++) expect(back[i]).toBeCloseTo(t[i]!, 9);
  });

  it("volatility is near the 18% the generator targets and zero for a flat tape", () => {
    expect(annualisedVol(new Array(50).fill(100))).toBe(0);
    const v = annualisedVol(makeTape(11, 2000));
    expect(v).toBeGreaterThan(0.15);
    expect(v).toBeLessThan(0.21);
  });
});

describe("the engine's CSV", () => {
  it("dates are weekdays from 2024-01-02", () => {
    const d = tradingDates(7);
    expect(d[0]).toBe("2024-01-02");
    expect(d).toHaveLength(7);
    for (const s of d) {
      const day = new Date(s + "T00:00:00Z").getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
    expect(d).toContain("2024-01-08"); // the Monday after the first weekend
  });

  it("writes a header, one row per close, and never a degenerate bar", () => {
    const csv = toCsv([100, 101, 99.5]);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("ts,open,high,low,close,volume");
    expect(lines).toHaveLength(4);
    for (const row of lines.slice(1)) {
      const [, open, high, low, close] = row.split(",").map(Number) as number[];
      expect(high).toBeGreaterThan(Math.max(open!, close!));
      expect(low).toBeLessThan(Math.min(open!, close!));
    }
    expect(lines[2]!.split(",")[1]).toBe("100.0000"); // open = previous close
  });
});
