import { describe, expect, it } from "vitest";
import { labelOn, oklchLuminance } from "@/lib/color";

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("label colour on a computed fill", () => {
  it("measures OKLCH lightness like sRGB luminance", () => {
    expect(oklchLuminance(0, 0, 0)).toBeCloseTo(0, 5);
    expect(oklchLuminance(1, 0, 0)).toBeCloseTo(1, 3);
    // a grey: OKLCH L cubed is its luminance
    expect(oklchLuminance(0.5, 0, 0)).toBeCloseTo(0.125, 3);
  });

  it("clears 4.5:1 at every step of a purple ramp", () => {
    for (let L = 0.2; L <= 0.85; L += 0.01) {
      const y = oklchLuminance(L, 0.16, 300);
      const text = labelOn(y) === "#000000" ? 0 : 1;
      expect(contrast(text, y)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
