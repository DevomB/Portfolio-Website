"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { commandKind, describeChanges, field, type BranchResult, type Domain, type MinimizeResult, type RunResult, type State, type Step } from "./ananke";
import type { Request, RequestBody, Response } from "./counterexample.worker";
import { useMoreRight } from "@/app/(chrome)/useMoreRight";

/* Counterexample.
   The engine (Ananke, js_of_ocaml build) runs in a Web Worker. This page
   owns the scenario controls, the timeline, the state view, and the two
   tools — minimize and branch. Every number shown came out of the runtime's
   own trace, minimizer or branch diff. */

const INVARIANTS: { name: string; means: string }[] = [
  { name: "holds_non_negative", means: "no account has a negative amount on hold" },
  { name: "holds_match_open_payments", means: "each account's hold equals what its open payments still have authorized but uncaptured" },
  { name: "balances_non_negative", means: "no account is overdrawn" },
  { name: "captures_within_authorization", means: "captured ≤ authorized and refunded ≤ captured, for every payment" },
  { name: "money_conserved", means: "balances plus holds add up to what was minted" },
];
const LENGTHS = [20, 40, 80];
const fmt = (n: number) => n.toLocaleString("en-US");
const kindColor: Record<string, string> = { Open_account: "var(--color-muted)", Authorize: "var(--color-accent-dim)", Capture: "var(--color-secondary)", Refund: "var(--color-warn)", Void: "var(--color-danger)" };

type Alt = { key: string; label: string; domain: Domain; baseline: string[]; alternate: string[]; note: string };

export default function Counterexample() {
  const [seed, setSeed] = useState(1);
  const [length, setLength] = useState(40);
  const [domain, setDomain] = useState<Domain>("buggy");

  const [engine, setEngine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commands, setCommands] = useState<string[]>([]);
  const [run, setRun] = useState<{ key: string; data: Extract<RunResult, { ok: true }>; ms: number } | null>(null);
  const [selected, setSelected] = useState(0);
  const [minimize, setMinimize] = useState<{ data: Extract<MinimizeResult, { ok: true }>; ms: number } | null>(null);
  const [minimizing, setMinimizing] = useState(false);
  const [branch, setBranch] = useState<{ alt: Alt; data: Extract<BranchResult, { ok: true }>; ms: number } | null>(null);
  const [branching, setBranching] = useState<string | null>(null);
  const [paymentsScroll, morePayments] = useMoreRight();

  // ── worker rpc ──
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, { resolve: (r: Response) => void }>());
  const nextId = useRef(1);
  const call = useCallback((req: RequestBody) => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL("./counterexample.worker.ts", import.meta.url), { type: "module" });
      workerRef.current.onmessage = (ev: MessageEvent<Response>) => {
        const p = pending.current.get(ev.data.id);
        if (p) { pending.current.delete(ev.data.id); p.resolve(ev.data); }
      };
    }
    const id = nextId.current++;
    return new Promise<Response>((resolve) => {
      pending.current.set(id, { resolve });
      workerRef.current!.postMessage({ ...req, id } as Request);
    });
  }, []);
  useEffect(() => () => workerRef.current?.terminate(), []);

  // ── record: generate the scenario for this seed, run it, land on the failure ──
  const runKey = `${seed}|${length}|${domain}`;
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const sc = await call({ type: "scenario", seed, length });
      if (cancelled) return;
      if (!sc.ok) { setError(sc.error); return; }
      const cmds = (sc.data as { commands: string[] }).commands;
      const r = await call({ type: "run", domain, commands: cmds });
      if (cancelled) return;
      if (!r.ok) { setError(r.error); return; }
      const data = r.data as RunResult;
      if (!data.ok) { setError(data.error); return; }
      setError(null);
      setEngine(r.version);
      setCommands(cmds);
      setRun({ key: runKey, data, ms: r.ms });
      setMinimize(null);
      setBranch(null);
      setSelected(data.stopped_at ?? data.rejected?.index ?? data.steps.length - 1);
    }, 80);
    return () => { cancelled = true; clearTimeout(t); };
  }, [seed, length, domain, runKey, call]);

  const data = run?.data ?? null;
  const pendingRun = !run || run.key !== runKey;
  const steps = useMemo(() => data?.steps ?? [], [data]);
  const stoppedAt = data?.stopped_at ?? null;
  const step: Step | undefined = steps[Math.min(selected, Math.max(0, steps.length - 1))];
  const prevState: State | null = step && step.index > 0 ? steps[step.index - 1]!.state : null;
  const readable = useMemo(() => (step ? describeChanges(prevState, step.state) : []), [step, prevState]);
  const violated = step?.checks.filter((c) => !c.ok) ?? [];

  // keyboard: arrows walk the timeline
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft") setSelected((s) => Math.max(0, s - 1));
      if (e.key === "ArrowRight") setSelected((s) => Math.min(steps.length - 1, s + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  // ── minimize ──
  const doMinimize = async () => {
    if (!data || minimizing) return;
    setMinimizing(true);
    const r = await call({ type: "minimize", domain, commands });
    setMinimizing(false);
    if (!r.ok) { setError(r.error); return; }
    const m = r.data as MinimizeResult;
    if (!m.ok) { setError(m.reason ?? m.error ?? "minimize failed"); return; }
    setMinimize({ data: m, ms: r.ms });
  };

  // ── branch: alternates for the failing command ──
  const alts = useMemo<Alt[]>(() => {
    if (!data || stoppedAt === null) return [];
    const failing = commands[stoppedAt]!;
    const kind = commandKind(failing);
    const pid = field(failing, "payment");
    const before = stoppedAt > 0 ? steps[stoppedAt - 1]!.state : null;
    const p = pid && before ? before.payments[pid] : undefined;
    const out: Alt[] = [{ key: "skip", label: "skip it", domain, baseline: [failing], alternate: [], note: "the same prefix, then nothing" }];
    if (kind === "Void" && p) {
      const remaining = p.authorized - p.captured;
      if (remaining > 0) out.push({ key: "capture", label: `capture the ${fmt(remaining)} left, then void`, domain, baseline: [failing], alternate: [`(Capture (key kx1) (payment ${pid}) (amount ${remaining}))`, `(Void (key kx2) (payment ${pid}))`], note: "nothing left on hold when the void lands" });
      const refundable = p.captured - p.refunded;
      const payee = before!.accounts[p.payee];
      if (refundable > 0 && payee && payee.balance >= refundable) out.push({ key: "refund", label: `refund the ${fmt(refundable)} captured, then void`, domain, baseline: [failing], alternate: [`(Refund (key kx1) (payment ${pid}) (amount ${refundable}))`, `(Void (key kx2) (payment ${pid}))`], note: "a refund does not change what was captured — the void still over-releases" });
    }
    if (domain === "buggy") out.push({ key: "fixed", label: "the same void, on the fixed domain", domain: "fixed", baseline: [failing], alternate: [], note: "fixed: a void releases only what is still on hold" });
    return out;
  }, [data, stoppedAt, commands, steps, domain]);

  const doBranch = async (alt: Alt) => {
    if (!data || stoppedAt === null || branching) return;
    setBranching(alt.key);
    const r = await call({ type: "branch", domain: alt.domain, prefix: commands.slice(0, stoppedAt), baseline: alt.baseline, alternate: alt.alternate });
    setBranching(null);
    if (!r.ok) { setError(r.error); return; }
    const b = r.data as BranchResult;
    if (!b.ok) { setError(b.error); return; }
    setBranch({ alt, data: b, ms: r.ms });
  };

  const stopMessage = data?.stop_error ? data.stop_error.replace(/^Invariant_violation:\s*/, "") : null;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
      <div className="min-w-0 space-y-6">
        {/* ── timeline ── */}
        <div className={`card-soft p-4 transition-opacity ${pendingRun ? "opacity-70" : ""}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1 pb-2">
            <p className="font-mono text-fluid-xs text-muted">trace · {steps.length} commands recorded · click a step, or use ← →</p>
            <p className="font-mono text-fluid-xs text-muted">{data ? `${fmt(data.events)} events · replay ${data.replay_ok ? "verified identical" : "DIVERGED"} · ${run!.ms} ms` : "recording…"}</p>
          </div>
          <div className="flex flex-wrap gap-[0.1875rem] px-1">
            {steps.map((s) => {
              const bad = s.checks.some((c) => !c.ok);
              const after = stoppedAt !== null && s.index > stoppedAt;
              const retry = s.events.some((e) => e.startsWith("(Duplicate_ignored"));
              return (
                <button
                  key={s.index}
                  type="button"
                  onClick={() => setSelected(s.index)}
                  aria-label={`step ${s.index + 1}: ${s.command}`}
                  title={s.command}
                  className="h-5 w-5 rounded-[0.1875rem] transition-transform hover:scale-110"
                  style={{
                    background: bad ? "var(--color-danger)" : retry ? "rgb(var(--color-warn-rgb) / 0.5)" : `color-mix(in oklab, ${kindColor[commandKind(s.command)] ?? "var(--color-muted)"} 45%, transparent)`,
                    opacity: after ? 0.3 : 1,
                    outline: s.index === selected ? "2px solid var(--color-secondary)" : undefined,
                    outlineOffset: 1,
                  }}
                />
              );
            })}
          </div>
          <p className="mt-2 px-1 font-mono text-fluid-xs text-muted">
            <span style={{ color: kindColor.Authorize }}>authorize</span> · <span style={{ color: kindColor.Capture }}>capture</span> · <span style={{ color: kindColor.Refund }}>refund</span> · <span style={{ color: kindColor.Void }}>void</span> · amber: a redelivered command · red: an invariant broke · dimmed: after the stop, shown for context
          </p>

          {step && (
            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="font-mono text-fluid-xs text-muted">step {step.index + 1}{stoppedAt === step.index ? " · the runtime stops here" : ""}</p>
                <p className="mt-1 break-all font-mono text-[0.72rem] text-ink" style={{ color: violated.length ? "var(--color-danger)" : undefined }}>{step.command}</p>
                <p className="mt-2 font-mono text-fluid-xs text-muted">emitted</p>
                <ul className="mt-0.5 space-y-0.5">
                  {step.events.map((e, i) => <li key={i} className="break-all font-mono text-fluid-xs text-ink">{e}</li>)}
                  {step.events.length === 0 && <li className="font-mono text-fluid-xs text-muted">nothing</li>}
                </ul>
                <p className="mt-2 font-mono text-fluid-xs text-muted">what changed</p>
                <ul className="mt-0.5 space-y-0.5">
                  {readable.map((c, i) => <li key={i} className="font-mono text-fluid-xs text-ink">{c}</li>)}
                  {readable.length === 0 && <li className="font-mono text-fluid-xs text-muted">nothing</li>}
                </ul>
                <p className="mt-1 font-mono text-fluid-xs text-muted">Ananke&apos;s structural diff: {step.changes.length} change{step.changes.length === 1 ? "" : "s"} by path</p>
              </div>
              <div>
                <p className="font-mono text-fluid-xs text-muted">invariants after this step</p>
                <ul className="mt-1 space-y-1">
                  {step.checks.map((c) => (
                    <li key={c.name} className="font-mono text-fluid-xs">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: c.ok ? "var(--color-secondary)" : "var(--color-danger)" }} />
                      <span className={c.ok ? "text-ink" : "text-danger"}>{c.name}</span>
                      {c.message && <span className="block pl-3.5 text-muted">{c.message}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* ── state ── */}
        {step && (
          <div className={`card-soft p-4 transition-opacity ${pendingRun ? "opacity-70" : ""}`}>
            <p className="font-mono text-fluid-xs text-muted px-1 pb-2">state after step {step.index + 1} · from the runtime&apos;s snapshot · changed cells highlighted</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="overflow-x-auto">
              <table className="w-full font-mono text-fluid-xs">
                <thead><tr className="text-left text-muted"><th className="px-1 py-1 font-normal">account</th><th className="px-1 py-1 font-normal text-right">balance</th><th className="px-1 py-1 font-normal text-right">on hold</th></tr></thead>
                <tbody>
                  {Object.entries(step.state.accounts).map(([name, a]) => {
                    const p = prevState?.accounts[name];
                    const hl = (changed: boolean, bad: boolean) => ({ background: changed ? "rgb(var(--brand-green-rgb) / 0.14)" : undefined, color: bad ? "var(--color-danger)" : undefined });
                    return (
                      <tr key={name} className="border-t border-border/60 text-ink">
                        <td className="px-1 py-1">{name}</td>
                        <td className="px-1 py-1 text-right tabular-nums" style={hl(!!p && p.balance !== a.balance, a.balance < 0)}>{fmt(a.balance)}</td>
                        <td className="px-1 py-1 text-right tabular-nums" style={hl(!!p && p.held !== a.held, a.held < 0)}>{fmt(a.held)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-border/60 text-muted"><td className="px-1 py-1">minted</td><td className="px-1 py-1 text-right tabular-nums" colSpan={2}>{fmt(step.state.minted)}</td></tr>
                </tbody>
              </table>
              </div>
              {/* on a phone the payments scroll sideways a line per row under a
                  pinned id column, with a fade while there is more to the right */}
              <div className="relative min-w-0">
              <div ref={paymentsScroll} className="overflow-x-auto">
              <table className="w-full font-mono text-fluid-xs">
                <thead><tr className="text-left text-muted"><th className="sticky left-0 z-[1] bg-surface-elevated bg-clip-padding px-1 py-1 font-normal">payment</th><th className="px-1 py-1 font-normal">route</th><th className="px-1 py-1 font-normal text-right">authorized</th><th className="px-1 py-1 font-normal text-right">captured</th><th className="px-1 py-1 font-normal text-right">refunded</th><th className="px-1 py-1 font-normal"></th></tr></thead>
                <tbody>
                  {Object.entries(step.state.payments).map(([id, p]) => {
                    const q = prevState?.payments[id];
                    const cell = (changed: boolean) => (changed ? { background: "rgb(var(--brand-green-rgb) / 0.14)" } : undefined);
                    return (
                      <tr key={id} className={`border-t border-border/60 ${p.closed ? "text-muted" : "text-ink"}`}>
                        <td className="sticky left-0 z-[1] bg-surface-elevated bg-clip-padding px-1 py-1">{id}</td>
                        <td className="whitespace-nowrap px-1 py-1">{p.payer} → {p.payee}</td>
                        <td className="px-1 py-1 text-right tabular-nums" style={cell(!q)}>{fmt(p.authorized)}</td>
                        <td className="px-1 py-1 text-right tabular-nums" style={cell(!!q && q.captured !== p.captured)}>{fmt(p.captured)}</td>
                        <td className="px-1 py-1 text-right tabular-nums" style={cell(!!q && q.refunded !== p.refunded)}>{fmt(p.refunded)}</td>
                        <td className="px-1 py-1" style={cell(!!q && q.closed !== p.closed)}>{p.closed ? "closed" : "open"}</td>
                      </tr>
                    );
                  })}
                  {Object.keys(step.state.payments).length === 0 && <tr><td className="px-1 py-1 text-muted" colSpan={6}>no payments yet</td></tr>}
                </tbody>
              </table>
              </div>
              {morePayments && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-elevated" />}
              </div>
            </div>
          </div>
        )}

        {/* ── minimize ── */}
        <div className="card-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="font-mono text-fluid-xs text-muted">minimize · shrink the failing scenario to a minimal reproduction</p>
            <button type="button" onClick={doMinimize} disabled={!data || stoppedAt === null || minimizing || pendingRun}
                    className="chip-soft px-3 py-1 font-mono text-fluid-xs text-ink disabled:opacity-40 hover:border-accent/40 transition-colors">
              {minimizing ? "shrinking…" : minimize ? "shrink again" : "minimize"}
            </button>
          </div>
          {stoppedAt === null && data && <p className="mt-2 px-1 font-mono text-fluid-xs text-muted">nothing to minimize — this run breaks no invariant</p>}
          {minimize && (
            <div className="mt-3 px-1">
              <p className="font-sans text-fluid-lg font-semibold leading-none text-ink">
                {minimize.data.original} → {minimize.data.minimized.length} commands
                <span className="ml-2 font-mono text-fluid-xs font-normal text-muted">{minimize.data.attempts} candidate runs · {minimize.ms} ms</span>
              </p>
              {/* one 3-of-5 unit bar per candidate; the strip squeezes to fit
                  its card instead of pushing the page wide on a long log */}
              <svg viewBox={`0 0 ${minimize.data.log.length * 5} 32`} preserveAspectRatio="none" className="mt-2 block h-8 w-full"
                   style={{ maxWidth: `${minimize.data.log.length * 0.3125}rem` }} role="img" aria-label="candidate lengths tried, in order; green ones still failed">
                {minimize.data.log.map((l, i) => {
                  const h = 32 * Math.max(0.08, l.length / minimize.data.original);
                  return (
                    <rect key={i} x={i * 5} y={32 - h} width={3} height={h} fill={l.fails ? "var(--color-secondary)" : "rgb(var(--brand-purple-rgb) / 0.35)"}>
                      <title>{`${l.length} commands · ${l.fails ? "still fails" : "passes"}`}</title>
                    </rect>
                  );
                })}
              </svg>
              <p className="mt-1 font-mono text-fluid-xs text-muted">each bar is one candidate Ananke replayed: height is its length, green still trips {minimize.data.error.split(":")[1]?.trim() ?? "the invariant"} · half-cuts first, then single drops</p>
              <ol className="mt-3 space-y-0.5">
                {minimize.data.minimized.map((c, i) => (
                  <li key={i} className="break-all font-mono text-fluid-xs" style={{ color: i === minimize.data.minimized.length - 1 ? "var(--color-danger)" : kindColor[commandKind(c)] ?? "var(--color-ink)" }}>
                    <span className="mr-2 text-muted">{i + 1}</span>{c}
                  </li>
                ))}
              </ol>
              <p className="mt-2 font-mono text-fluid-xs text-muted">
                a candidate counts as still failing when the same invariant breaks; commands that only make sense in pairs (an authorize and its void) survive a single-drop pass, so the result is small, not always the smallest
              </p>
            </div>
          )}
        </div>

        {/* ── branch ── */}
        <div className="card-soft p-4">
          <p className="font-mono text-fluid-xs text-muted px-1">branch · fork the world at step {stoppedAt !== null ? stoppedAt : "—"}, before the command that broke it, and run a different future</p>
          <div className="mt-2 flex flex-wrap gap-1.5 px-1">
            {alts.map((a) => (
              <button key={a.key} type="button" onClick={() => doBranch(a)} disabled={!!branching || pendingRun}
                      className={`chip-soft px-2.5 py-1 font-mono text-fluid-xs transition-colors disabled:opacity-40 ${branch?.alt.key === a.key ? "border-accent/60 text-ink" : "text-muted hover:text-ink hover:border-accent/40"}`}>
                {branching === a.key ? "forking…" : a.label}
              </button>
            ))}
            {alts.length === 0 && <span className="font-mono text-fluid-xs text-muted">nothing to fork — this run breaks no invariant</span>}
          </div>
          {branch && (
            <div className="mt-3 px-1">
              <p className="font-mono text-fluid-xs text-muted">{branch.alt.note} · restored from the snapshot after step {branch.data.forked_after} · {branch.ms} ms</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(["baseline", "alternate"] as const).map((side) => {
                  const s = branch.data[side];
                  return (
                    <div key={side} className="rounded-md border border-border px-3 py-2">
                      <p className="font-mono text-fluid-xs text-muted">{side === "baseline" ? "as recorded" : "the alternate future"}{branch.alt.domain === "fixed" ? " · fixed domain" : ""}</p>
                      <p className="mt-1 font-sans text-fluid-lg font-semibold leading-tight" style={{ color: s.violations.length ? "var(--color-danger)" : "var(--color-secondary)" }}>
                        {s.violations.length ? `${s.violations.length} violation${s.violations.length > 1 ? "s" : ""}` : "every invariant holds"}
                      </p>
                      {s.violations.slice(0, 2).map((v, i) => <p key={i} className="mt-0.5 font-mono text-fluid-xs text-muted">{v.message ?? v.name}</p>)}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 font-mono text-fluid-xs text-muted">{branch.data.diverged ? `the two futures diverge · Ananke's structural diff: ${branch.data.changes.length} changes` : "the two futures end in the same state"}</p>
              {branch.data.baseline.state && branch.data.alternate.state && (
                <ul className="mt-1 space-y-0.5">
                  {describeChanges(branch.data.baseline.state, branch.data.alternate.state).map((c, i) => <li key={i} className="font-mono text-fluid-xs text-ink">{c}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── verdict + controls ── */}
      <div className="min-w-0 space-y-6">
        <div className="card-soft p-5">
          <p className="font-mono text-fluid-xs text-muted">the run</p>
          <p className={`mt-2 font-sans text-[2.2rem] font-bold leading-none tracking-tight ${!data ? "text-muted" : stoppedAt !== null ? "text-danger" : "text-ink"}`}>
            {!data ? "—" : stoppedAt !== null ? `stopped at ${stoppedAt + 1}` : `${steps.length} clean`}
          </p>
          {data && (
            <p className="mt-2 font-mono text-fluid-xs leading-relaxed text-muted">
              {stoppedAt !== null ? <>of {steps.length} commands · <span className="text-ink">{stopMessage}</span></> : <>commands, every invariant held throughout{domain === "fixed" ? " — this is the fixed domain" : ""}</>}
            </p>
          )}
          {data?.rejected && <p className="mt-2 font-mono text-fluid-xs text-warn">command {data.rejected.index + 1} rejected: {data.rejected.error}</p>}
          {error && <p className="mt-3 font-mono text-fluid-xs text-danger break-words">{error}</p>}
          <p className="mt-4 font-mono text-fluid-xs leading-relaxed text-muted">
            {engine ?? "ananke"} · OCaml 5.2 → js_of_ocaml · runs in this tab · {domain === "buggy" ? "buggy domain" : "fixed domain"} · seed {seed}
          </p>
        </div>

        <div className="card-soft p-5 space-y-4">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-fluid-xs">
            <label className="text-muted">scenario seed
              <div className="mt-1 flex gap-1">
                <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} className="w-full rounded border border-border bg-surface px-2 py-1 text-ink" />
                <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 100000))} className="chip-soft px-2 text-muted hover:text-ink">new</button>
              </div>
            </label>
            <label className="text-muted">commands
              <select value={length} onChange={(e) => setLength(+e.target.value)} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink">
                {LENGTHS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div>
            <p className="font-mono text-fluid-xs text-muted mb-2">domain</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(["buggy", "fixed"] as Domain[]).map((d) => (
                <button key={d} type="button" onClick={() => setDomain(d)}
                        className={`rounded-md px-2 py-1.5 text-left font-mono text-fluid-xs transition-colors ${domain === d ? "bg-accent-bg text-accent-dim" : "text-muted hover:text-ink hover:bg-surface"}`}>
                  {d === "buggy" ? "as shipped" : "fixed"}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-fluid-xs text-muted leading-relaxed">
              {domain === "buggy"
                ? "the bug: voiding a payment releases its whole authorization, forgetting the part already captured and paid to the payee"
                : "the fix: a void releases only what is still on hold"}
            </p>
          </div>
        </div>

        <div className="card-soft p-5">
          <p className="font-mono text-fluid-xs text-muted">what must always be true</p>
          <ul className="mt-2 space-y-1.5">
            {INVARIANTS.map((inv) => (
              <li key={inv.name} className="font-mono text-fluid-xs">
                <span className="text-ink">{inv.name}</span>
                <span className="block text-muted">{inv.means}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-fluid-xs leading-relaxed text-muted">
            checked by the runtime after every command. money_conserved never catches this bug — both sides of the bad release are the payer&apos;s own columns — which is why the hold ledger is an invariant of its own.
          </p>
        </div>
      </div>
    </div>
  );
}
