import { NextResponse } from "next/server";
import type { PokerCalculations } from "poker-calculations";

/* What the poker routes share: the native engine (poker-calculations, C++ via
   N-API), the answers they give when a request or the host is not up to it,
   and the one request field they all read. The engine is loaded once per
   process; a host without the addon is remembered as unavailable so the
   import is not retried on every request. */

let native: PokerCalculations | "unavailable" | undefined;

export async function loadNative(): Promise<PokerCalculations | null> {
  if (native === "unavailable") return null;
  if (native !== undefined) return native;
  try {
    native = (await import("poker-calculations")).default as PokerCalculations;
    return native;
  } catch {
    native = "unavailable";
    return null;
  }
}

/** Forget a loaded engine after it threw; the next call falls back. */
export function dropNative(): void {
  native = "unavailable";
}

export const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export const engineUnavailable = () =>
  NextResponse.json({ error: "The native engine is unavailable on this host." }, { status: 503 });

/** Villain's range: 169 class weights in matrix order, clamped to 0..1, not all zero. */
export function readRange(range: unknown): number[] | NextResponse {
  if (!Array.isArray(range) || range.length !== 169 || !range.every((w) => typeof w === "number")) return bad("range must be 169 class weights.");
  const weights = (range as number[]).map((w) => Math.min(1, Math.max(0, w)));
  if (weights.every((w) => w === 0)) return bad("villain range is empty.");
  return weights;
}
