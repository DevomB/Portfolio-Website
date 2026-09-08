/* Loader and types for the Counterexample engine: Ananke (OCaml) compiled to
   JavaScript by js_of_ocaml, with the payments domain and a thin bridge that
   answers in JSON. The bundle exports one global, `ananke`; commands travel as
   Ananke's own sexp syntax, one per line. Nothing about the runtime changes:
   the bridge calls Runtime, Replay, Minimize and Branch as the CLI does. */

export type Domain = "buggy" | "fixed";

export type Check = { name: string; ok: boolean; message?: string };
export type Account = { balance: number; held: number };
export type Payment = { payer: string; payee: string; authorized: number; captured: number; refunded: number; closed: boolean };
export type State = { accounts: Record<string, Account>; payments: Record<string, Payment>; keys: number; minted: number };
export type Step = { index: number; command: string; events: string[]; checks: Check[]; state: State; changes: string[] };

export type RunResult =
  | { ok: true; domain: string; steps: Step[]; stopped_at: number | null; stop_error: string | null; rejected: { index: number; error: string } | null; replay_ok: boolean; events: number }
  | { ok: false; error: string };
export type MinimizeResult =
  | { ok: true; error: string; original: number; minimized: string[]; attempts: number; log: { length: number; fails: boolean }[] }
  | { ok: false; reason?: string; error?: string };
export type BranchSide = { state: State | null; violations: Check[] };
export type BranchResult =
  | { ok: true; diverged: boolean; forked_after: number; changes: string[]; baseline: BranchSide; alternate: BranchSide }
  | { ok: false; error: string };

export type AnankeApi = {
  version(): string;
  scenario(seed: number, length: number): string;
  run(domain: string, commands: string): string;
  minimize(domain: string, commands: string): string;
  branch(domain: string, prefix: string, baseline: string, alternate: string): string;
};

export async function loadAnanke(url = "/wasm/ananke-counterexample.js"): Promise<AnankeApi> {
  const src = await (await fetch(url)).text();
  // the bundle is a classic script that installs `globalThis.ananke`
  new Function(src)();
  const api = (globalThis as { ananke?: AnankeApi }).ananke;
  if (!api) throw new Error("the Ananke bundle did not export its API");
  return api;
}

/** The sexp constructor of a command line, e.g. "Void". */
export const commandKind = (line: string) => /^\((\w+)/.exec(line)?.[1] ?? "?";
/** A named field of a command sexp, e.g. field(line, "payment") -> "p3". */
export const field = (line: string, name: string) => new RegExp(`\\(${name} ([^)]+)\\)`).exec(line)?.[1];

/** Human-readable differences between two states (the page's own reading; Ananke's structural diff counts changes by path). */
export function describeChanges(a: State | null, b: State): string[] {
  const out = [...accountChanges(a, b), ...paymentChanges(a, b)];
  if (a && a.keys !== b.keys && out.length === 0) out.push("a new idempotency key, nothing else");
  return out;
}

function accountChanges(a: State | null, b: State): string[] {
  const out: string[] = [];
  for (const [name, acc] of Object.entries(b.accounts)) {
    const prev = a?.accounts[name];
    if (!prev) { out.push(`${name} opened with ${acc.balance}`); continue; }
    if (prev.balance !== acc.balance) out.push(`${name} balance ${prev.balance} → ${acc.balance}`);
    if (prev.held !== acc.held) out.push(`${name} held ${prev.held} → ${acc.held}`);
  }
  return out;
}

function paymentChanges(a: State | null, b: State): string[] {
  const out: string[] = [];
  for (const [id, p] of Object.entries(b.payments)) {
    const prev = a?.payments[id];
    if (!prev) { out.push(`${id}: ${p.payer} → ${p.payee}, ${p.authorized} authorized`); continue; }
    if (prev.captured !== p.captured) out.push(`${id} captured ${prev.captured} → ${p.captured}`);
    if (prev.refunded !== p.refunded) out.push(`${id} refunded ${prev.refunded} → ${p.refunded}`);
    if (prev.closed !== p.closed) out.push(`${id} ${p.closed ? "closed" : "reopened"}`);
  }
  return out;
}
