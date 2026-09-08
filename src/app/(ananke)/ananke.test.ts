import { describe, expect, it } from "vitest";
import { commandKind, describeChanges, field, type State } from "@/app/(ananke)/ananke";

const state = (over: Partial<State> = {}): State => ({
  accounts: { alice: { balance: 100, held: 0 } },
  payments: {},
  keys: 0,
  minted: 0,
  ...over,
});

describe("command sexps", () => {
  it("reads the constructor and named fields", () => {
    const line = "(Capture (payment p3) (amount 40))";
    expect(commandKind(line)).toBe("Capture");
    expect(field(line, "payment")).toBe("p3");
    expect(field(line, "amount")).toBe("40");
    expect(field(line, "missing")).toBeUndefined();
    expect(commandKind("garbage")).toBe("?");
  });
});

describe("describeChanges", () => {
  it("describes the first state as openings and authorizations", () => {
    const b = state({ payments: { p1: { payer: "alice", payee: "bob", authorized: 30, captured: 0, refunded: 0, closed: false } } });
    expect(describeChanges(null, b)).toEqual(["alice opened with 100", "p1: alice → bob, 30 authorized"]);
  });

  it("names exactly what moved between two states", () => {
    const a = state({ payments: { p1: { payer: "alice", payee: "bob", authorized: 30, captured: 0, refunded: 0, closed: false } } });
    const b = state({
      accounts: { alice: { balance: 70, held: 30 } },
      payments: { p1: { payer: "alice", payee: "bob", authorized: 30, captured: 30, refunded: 0, closed: true } },
    });
    expect(describeChanges(a, b)).toEqual([
      "alice balance 100 → 70",
      "alice held 0 → 30",
      "p1 captured 0 → 30",
      "p1 closed",
    ]);
  });

  it("calls out a step that only minted an idempotency key", () => {
    expect(describeChanges(state(), state({ keys: 1 }))).toEqual(["a new idempotency key, nothing else"]);
    expect(describeChanges(state(), state())).toEqual([]);
  });
});
