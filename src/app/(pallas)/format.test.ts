import { describe, expect, it } from "vitest";
import { money, sharpeFmt } from "@/app/(pallas)/format";

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
