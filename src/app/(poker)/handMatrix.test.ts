import { describe, expect, it } from "vitest";
import { RANGE_PRESETS, cellIndex, cellOf, classCombos, classLabel, liveCombos, rangeComboCount } from "@/app/(poker)/handMatrix";

describe("the 13×13 matrix", () => {
  it("indexes cells both ways", () => {
    for (let k = 0; k < 169; k++) {
      const { i, j } = cellOf(k);
      expect(cellIndex(i, j)).toBe(k);
    }
  });

  it("labels pairs, suited above the diagonal, offsuit below", () => {
    expect(classLabel(0, 0)).toBe("AA");
    expect(classLabel(0, 1)).toBe("AKs");
    expect(classLabel(1, 0)).toBe("AKo");
    expect(classLabel(12, 12)).toBe("22");
    expect(classLabel(11, 12)).toBe("32s");
  });

  it("expands a class into 6, 4 or 12 distinct real combos", () => {
    const check = (i: number, j: number, n: number) => {
      const combos = classCombos(i, j);
      expect(combos).toHaveLength(n);
      expect(new Set(combos.map(([a, b]) => [a, b].sort().join(""))).size).toBe(n);
      for (const [a, b] of combos) {
        expect(a).toMatch(/^[AKQJT98765432][shdc]$/);
        expect(b).toMatch(/^[AKQJT98765432][shdc]$/);
        expect(a).not.toBe(b);
      }
    };
    check(0, 0, 6);
    check(0, 1, 4);
    check(1, 0, 12);
    let total = 0;
    for (let k = 0; k < 169; k++) total += classCombos(cellOf(k).i, cellOf(k).j).length;
    expect(total).toBe(1326);
  });

  it("removes combos that collide with the board", () => {
    expect(liveCombos(0, 0, ["As"])).toHaveLength(3);
    expect(liveCombos(0, 0, ["As", "Ah"])).toHaveLength(1);
    expect(liveCombos(0, 1, ["Ks"])).toHaveLength(3);
    expect(rangeComboCount(new Array(169).fill(true), [])).toBe(1326);
    expect(rangeComboCount(new Array(169).fill(true), ["As"])).toBe(1326 - 51);
  });

  it("ships presets whose classes are real labels", () => {
    const all = new Set(Array.from({ length: 169 }, (_, k) => classLabel(cellOf(k).i, cellOf(k).j)));
    expect(RANGE_PRESETS.find((p) => p.key === "all")!.classes.size).toBe(169);
    for (const p of RANGE_PRESETS) for (const c of p.classes) expect(all.has(c), `${p.key}: ${c}`).toBe(true);
    expect(RANGE_PRESETS.find((p) => p.key === "pairs")!.classes.size).toBe(13);
  });
});
