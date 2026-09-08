import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/app/(poker)/poker";
import { normal } from "@/app/(pallas)/gaussian";

describe("normal", () => {
  it("draws a standard normal: mean near 0, variance near 1, symmetric tails", () => {
    const rng = mulberry32(2024);
    const xs = Array.from({ length: 50_000 }, () => normal(rng));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(variance).toBeGreaterThan(0.96);
    expect(variance).toBeLessThan(1.04);
    const beyond2 = xs.filter((x) => Math.abs(x) > 2).length / xs.length;
    expect(beyond2).toBeGreaterThan(0.035);
    expect(beyond2).toBeLessThan(0.056);
  });

  it("never returns NaN even when the uniform source yields zeros", () => {
    let calls = 0;
    const zerosThenHalf = () => (calls++ < 3 ? 0 : 0.5);
    expect(Number.isFinite(normal(zerosThenHalf))).toBe(true);
  });
});
