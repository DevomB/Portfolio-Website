import { NextResponse } from "next/server";
import type { PokerCalculations } from "poker-calculations";

/* The native engine (poker-calculations, C++ via N-API) and the answers every
   poker route gives when a request or the host is not up to it. Loaded once
   per process; a host without the addon is remembered as unavailable so the
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
