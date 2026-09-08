import { describe, expect, it } from "vitest";
import { clamp, clamp01 } from "@/lib/num";

describe("clamp", () => {
  it("pins a value inside [lo, hi]", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.33)).toBe(0.33);
  });
});
