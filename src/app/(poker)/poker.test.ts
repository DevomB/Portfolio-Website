import { describe, expect, it } from "vitest";
import {
  canonicalizeHand, cardKey, classifyFive, dealRandomHoleCards, evaluateFive, findSampleWin, formatCard, fullDeck,
  mulberry32, parseCard, parseCodes, shuffleInPlace, simulateEquityMonteCarloJs, type Card,
} from "@/app/(poker)/poker";

const hand = (codes: string): Card[] => codes.split(" ").map((c) => parseCard(c)!);

describe("cards", () => {
  it("parses codes in either case and rejects junk", () => {
    expect(parseCard("Ah")).toEqual({ rank: 14, suit: 2 });
    expect(parseCard("td")).toEqual({ rank: 10, suit: 1 });
    expect(parseCard("2c")).toEqual({ rank: 2, suit: 0 });
    expect(parseCard("Xx")).toBeNull();
    expect(parseCard("A")).toBeNull();
    expect(parseCard("")).toBeNull();
  });

  it("round-trips the whole deck through formatCard and gives every card a distinct key", () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardKey)).size).toBe(52);
    for (const c of deck) expect(parseCard(formatCard(c))).toEqual(c);
  });

  it("canonicalizes case and refuses bad or duplicate cards", () => {
    expect(canonicalizeHand(["ah", "KD"])).toEqual(["Ah", "Kd"]);
    expect(() => canonicalizeHand(["Ah", "Zz"])).toThrow(/Bad card/);
    expect(() => canonicalizeHand(["Ah", "ah"])).toThrow(/Duplicate/);
  });

  it("splits a line of codes on whitespace and commas", () => {
    expect(parseCodes(" Ah Kd,Qs  ,  ")).toEqual(["Ah", "Kd", "Qs"]);
    expect(parseCodes("")).toEqual([]);
  });
});

describe("evaluateFive", () => {
  const rank = (codes: string) => evaluateFive(hand(codes));

  it("names every category with the right leading value", () => {
    expect(rank("Ah Kh Qh Jh Th")).toEqual([8, 14]);
    expect(rank("5c 4c 3c 2c Ac")).toEqual([8, 5]); // the wheel, suited
    expect(rank("9s 9h 9d 9c 2h")).toEqual([7, 9, 2]);
    expect(rank("Ks Kh Kd 3c 3h")).toEqual([6, 13, 3]);
    expect(rank("Ah 9h 7h 4h 2h")).toEqual([5, 14, 9, 7, 4, 2]);
    expect(rank("Ts 9h 8d 7c 6h")).toEqual([4, 10]);
    expect(rank("Ah 2d 3c 4s 5h")).toEqual([4, 5]); // the wheel, offsuit
    expect(rank("7s 7h 7d Ac 2h")).toEqual([3, 7, 14, 2]);
    expect(rank("Js Jh 4d 4c Ah")).toEqual([2, 11, 4, 14]);
    expect(rank("Qs Qh 9d 5c 2h")).toEqual([1, 12, 9, 5, 2]);
    expect(rank("Ks Jh 9d 5c 2h")).toEqual([0, 13, 11, 9, 5, 2]);
  });

  it("orders hands the way the table does", () => {
    const beats = (a: string, b: string) => {
      const x = rank(a), y = rank(b);
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
      }
      return false;
    };
    expect(beats("Ah 9h 7h 4h 2h", "Ts 9h 8d 7c 6h")).toBe(true); // flush > straight
    expect(beats("Ts 9h 8d 7c 6h", "Ah 2d 3c 4s 5h")).toBe(true); // ten-high > wheel
    expect(beats("Qs Qh 9d 5c 2h", "Js Jh Td 5c 2h")).toBe(true); // higher pair
    expect(beats("Qs Qh 9d 5c 2h", "Qd Qc 9h 5d 3h")).toBe(false); // kicker decides
  });

  it("classifies for display, with the royal flush as its own tier", () => {
    expect(classifyFive(hand("Ah Kh Qh Jh Th"))).toEqual({ tier: 9, name: "Royal Flush" });
    expect(classifyFive(hand("5c 4c 3c 2c Ac"))).toEqual({ tier: 8, name: "Straight Flush" });
    expect(classifyFive(hand("Ks Jh 9d 5c 2h"))).toEqual({ tier: 0, name: "High Card" });
  });
});

describe("randomness", () => {
  it("mulberry32 is deterministic and stays in [0, 1)", () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(mulberry32(43)()).not.toBe(mulberry32(42)());
  });

  it("shuffleInPlace permutes the deck deterministically", () => {
    const deck = fullDeck();
    shuffleInPlace(deck, mulberry32(7));
    expect(deck).not.toEqual(fullDeck());
    expect([...deck].sort((x, y) => cardKey(x) - cardKey(y))).toEqual(fullDeck().sort((x, y) => cardKey(x) - cardKey(y)));
    const again = fullDeck();
    shuffleInPlace(again, mulberry32(7));
    expect(again).toEqual(deck);
  });

  it("deals two distinct hole cards for a seed", () => {
    const [a, b] = dealRandomHoleCards(99);
    expect(parseCard(a)).not.toBeNull();
    expect(parseCard(b)).not.toBeNull();
    expect(a).not.toBe(b);
    expect(dealRandomHoleCards(99)).toEqual([a, b]);
  });
});

describe("Monte Carlo equity (JS mirror)", () => {
  it("puts aces near 85% heads-up and is exactly repeatable per seed", () => {
    const e = simulateEquityMonteCarloJs(["Ah", "Ad"], [], 4000, 1);
    expect(e).toBeGreaterThan(0.81);
    expect(e).toBeLessThan(0.89);
    expect(simulateEquityMonteCarloJs(["Ah", "Ad"], [], 4000, 1)).toBe(e);
  });

  it("is exact once the board is complete", () => {
    // hero has the nut flush on a five-card board: nothing beats it
    expect(simulateEquityMonteCarloJs(["Ah", "2h"], ["Kh", "9h", "4h", "3c", "2d"], 200, 5)).toBe(1);
  });

  it("finds a winning run whose cards never collide with the hero", () => {
    const s = findSampleWin(["Ah", "Ad"], ["Kc"], 3)!;
    expect(s).not.toBeNull();
    expect(s.board5).toHaveLength(5);
    expect(s.board5[0]).toBe("Kc");
    expect(s.villain).toHaveLength(2);
    expect(new Set([...s.board5, ...s.villain, "Ah", "Ad"]).size).toBe(9);
    expect(s.heroInBest.some(Boolean)).toBe(true);
  });
});
