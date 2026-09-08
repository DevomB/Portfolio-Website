import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { bad, engineUnavailable, readRange } from "@/app/(poker)/api/poker/engine";

describe("the answers every poker route shares", () => {
  it("bad() is a 400 carrying the message", async () => {
    const res = bad("board must be 5 card codes.");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "board must be 5 card codes." });
  });

  it("engineUnavailable() is a 503", () => {
    expect(engineUnavailable().status).toBe(503);
  });
});

describe("readRange", () => {
  const full = new Array(169).fill(1);

  it("accepts 169 weights and clamps them to 0..1", () => {
    const w = readRange([...full.slice(0, 168), 7]) as number[];
    expect(Array.isArray(w)).toBe(true);
    expect(w).toHaveLength(169);
    expect(w[168]).toBe(1);
    expect((readRange([...full.slice(0, 168), -2]) as number[])[168]).toBe(0);
  });

  it("rejects the wrong shape and an empty range", async () => {
    for (const input of [null, "x", new Array(168).fill(1), [...full.slice(0, 168), "1"]]) {
      const r = readRange(input);
      expect(r).toBeInstanceOf(NextResponse);
      expect((r as NextResponse).status).toBe(400);
    }
    const empty = readRange(new Array(169).fill(0)) as NextResponse;
    expect(await empty.json()).toEqual({ error: "villain range is empty." });
  });
});
