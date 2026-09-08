import { NextResponse } from "next/server";
import { canonicalizeHand, parseCodes, simulateEquityMonteCarloJs } from "@/app/(poker)/poker";
import { bad, dropNative, loadNative } from "@/app/(poker)/api/poker/engine";

export const runtime = "nodejs";

type EquityParams = { hero: string[]; board: string[]; iterations: number; seed: number };

/** Read and validate the request body. Returns the params, or the response to send instead. */
function readParams(body: unknown): EquityParams | NextResponse {
  if (!body || typeof body !== "object") return bad("Expected JSON object.");
  const { heroLine, boardLine, iterations, seed } = body as Record<string, unknown>;
  if (typeof heroLine !== "string" || typeof boardLine !== "string") {
    return bad("heroLine and boardLine must be strings.");
  }
  const heroCodes = parseCodes(heroLine);
  const boardCodes = parseCodes(boardLine);
  if (heroCodes.length !== 2) return bad("Hero needs exactly two hole cards.");
  if (![0, 3, 4, 5].includes(boardCodes.length)) return bad("Board must have 0, 3, 4, or 5 cards.");

  let hero: string[], board: string[];
  try {
    hero = canonicalizeHand(heroCodes);
    board = canonicalizeHand(boardCodes);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Invalid cards.");
  }
  if (new Set([...hero, ...board]).size !== hero.length + board.length) {
    return bad("Duplicate cards between hero and board.");
  }
  return {
    hero,
    board,
    iterations: clampIterations(iterations),
    seed: typeof seed === "number" && Number.isFinite(seed) ? seed >>> 0 : 2_463_534_242,
  };
}

function clampIterations(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(250_000, Math.max(500, Math.floor(v))) : 6000;
}

/** Native engine first; the JS mirror if it is missing or throws. */
async function runEquity({ hero, board, iterations, seed }: EquityParams): Promise<number> {
  try {
    const native = await loadNative();
    if (native) return native.simulateHandOutcome(hero, board, iterations, seed, 1);
  } catch {
    dropNative();
  }
  return simulateEquityMonteCarloJs(hero, board, iterations, seed);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }
  const params = readParams(body);
  if (params instanceof NextResponse) return params;

  const t0 = performance.now();
  let equityFraction: number;
  try {
    equityFraction = await runEquity(params);
  } catch (e) {
    return bad(e instanceof Error ? e.message : "Simulation failed.");
  }
  const durationMs = performance.now() - t0;
  const sec = Math.max(durationMs / 1000, 1e-6);

  return NextResponse.json({
    equity: equityFraction * 100,
    iterations: params.iterations,
    seed: params.seed,
    durationMs,
    iterationsPerSec: params.iterations / sec,
    heroDisplay: params.hero,
    boardDisplay: params.board,
  });
}
