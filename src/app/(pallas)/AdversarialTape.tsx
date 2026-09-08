"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import LineChart from "./LineChart";
import { money } from "./format";
import { makeTape, TAPE_LEN, type SearchMessage, type SearchStart } from "./tape";
import type { ArenaParams, ArenaStrategy } from "./pallasArena";
import { useEngineWorker } from "./useEngineWorker";

/* Adversarial Tape.
   The engine (Athena's Pallas, WASI build) runs in a Web Worker. This page
   owns the controls, the two charts, and a per-visitor leaderboard of the
   worst worlds found. Every number on screen came out of the engine's own
   BacktestReport. */

const STRATEGIES: { key: ArenaStrategy; label: string; blurb: string }[] = [
  { key: "sma_cross", label: "SMA crossover", blurb: "long when the fast average is above the slow one — a trend follower; whipsaws hurt" },
  { key: "momentum", label: "Momentum", blurb: "long when price is above where it was N bars ago — trend, with a shorter memory" },
  { key: "mean_revert", label: "Mean reversion", blurb: "buy z standard deviations below the mean, sell at the mean — grinding trends hurt" },
  { key: "buy_and_hold", label: "Buy & hold", blurb: "one fill on bar one — with endpoints pinned, the attacker has nothing to move" },
];

type Progress = Extract<SearchMessage, { type: "progress" }>;
type World = {
  id: string;
  at: number;
  strategy: ArenaStrategy;
  params: ArenaParams;
  seed: number;
  basePnl: number;
  worstPnl: number;
  closes: number[];
  equity: number[];
};

const LB_KEY = "pallas-arena-worlds";

export default function AdversarialTape() {
  const [strategy, setStrategy] = useState<ArenaStrategy>("sma_cross");
  const [params, setParams] = useState<Required<ArenaParams>>({ fast: 10, slow: 30, lookback: 20, qty: 10, z_entry: 1 });
  const [seed, setSeed] = useState(7);
  const [iters, setIters] = useState(1500);
  const [volCap, setVolCap] = useState(1.3);

  const [phase, setPhase] = useState<"idle" | "loading" | "running" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<{ pnl: number; equity: number[] } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [viewing, setViewing] = useState<World | null>(null);
  const worker = useEngineWorker<SearchMessage>(() => new Worker(new URL("./adversarial.worker.ts", import.meta.url), { type: "module" }));

  const closes = useMemo(() => makeTape(seed, TAPE_LEN), [seed]);

  // leaderboard lives in this browser only; read after the first paint (a
  // frame callback, never a synchronous setState inside the effect body)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try { const raw = localStorage.getItem(LB_KEY); if (raw) setWorlds(JSON.parse(raw)); } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const remember = useCallback((w: World) => {
    setWorlds((prev) => {
      const next = [...prev.filter((p) => p.id !== w.id), w]
        .sort((a, b) => (a.worstPnl - a.basePnl) - (b.worstPnl - b.basePnl))
        .slice(0, 8);
      try { localStorage.setItem(LB_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const attack = () => {
    setError(null); setProgress(null); setBaseline(null); setViewing(null);
    setPhase("loading");
    const start: SearchStart = { type: "start", closes, strategy, params, seed: seed * 7919 + 1, maxIters: iters, volCap };
    worker.start(start, (m) => {
      if (m.type === "ready") return;
      if (m.type === "baseline") { setBaseline({ pnl: m.pnl, equity: m.equity }); setPhase("running"); return; }
      if (m.type === "progress") { setProgress(m); return; }
      if (m.type === "error") { setError(m.message); setPhase("idle"); return; }
      if (m.type === "done") {
        setPhase("done");
        setProgress((p) => p ? { ...p, iter: m.iter, evals: m.evals, bestPnl: m.bestPnl, bestCloses: m.bestCloses, bestEquity: m.bestEquity } : p);
        setBaseline((b) => {
          if (b && m.bestPnl < b.pnl) {
            remember({ id: `${strategy}-${seed}-${Date.now()}`, at: Date.now(), strategy, params, seed, basePnl: b.pnl, worstPnl: m.bestPnl, closes: m.bestCloses, equity: m.bestEquity });
          }
          return b;
        });
      }
    });
  };

  const shownBase = viewing ? { pnl: viewing.basePnl, equity: null } : baseline;
  const shownWorst = viewing ? { pnl: viewing.worstPnl, closes: viewing.closes, equity: viewing.equity } : progress ? { pnl: progress.bestPnl, closes: progress.bestCloses, equity: progress.bestEquity } : null;
  const damage = shownBase && shownWorst ? shownWorst.pnl - shownBase.pnl : null;
  const running = phase === "loading" || phase === "running";
  const strat = STRATEGIES.find((s) => s.key === strategy)!;

  const set = (k: keyof Required<ArenaParams>, v: number) => setParams((p) => ({ ...p, [k]: v }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        {/* tape */}
        <div className="card-soft p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1 pb-2">
            <p className="font-mono text-fluid-xs text-muted">price · original tape vs the worst world found</p>
            {progress && (
              <p className="font-mono text-[0.6rem] text-muted/70">
                {Math.round(progress.evalsPerSec)} backtests/s · {progress.evals} evaluated · {progress.accepted} accepted · T={progress.temperature.toFixed(1)}
              </p>
            )}
          </div>
          <LineChart id="tape-chart" series={[viewing ? makeTape(viewing.seed, TAPE_LEN) : closes, shownWorst?.closes ?? null]}
                     labels={["original", "adversarial"]} hover={hover} onHover={setHover} format={(v) => v.toFixed(2)} />
        </div>

        {/* equity */}
        <div className="card-soft p-4">
          <p className="font-mono text-fluid-xs text-muted px-1 pb-2">strategy equity · on the original vs on the worst world</p>
          <LineChart id="equity-chart" series={[shownBase?.equity ?? null, shownWorst?.equity ?? null]} height={180}
                     labels={["original", "adversarial"]} hover={hover} onHover={setHover} format={(v) => "$" + Math.round(v).toLocaleString("en-US")} />
          {!baseline && !viewing && (
            <p className="mt-2 px-1 font-mono text-[0.62rem] text-muted/70">attack to see the strategy&apos;s equity on both worlds</p>
          )}
        </div>

        {/* leaderboard */}
        <div className="card-soft p-4">
          <p className="font-mono text-fluid-xs text-muted px-1">worst worlds found on this browser</p>
          {worlds.length === 0 ? (
            <p className="mt-2 px-1 font-mono text-[0.62rem] text-muted/70">none yet — the leaderboard fills as attacks finish</p>
          ) : (
            <table className="mt-2 w-full font-mono text-[0.66rem]">
              <thead><tr className="text-left text-muted"><th className="px-1 py-1 font-normal">#</th><th className="px-1 py-1 font-normal">strategy</th><th className="px-1 py-1 font-normal text-right">original</th><th className="px-1 py-1 font-normal text-right">worst</th><th className="px-1 py-1 font-normal text-right">damage</th><th className="px-1 py-1 font-normal">tape</th></tr></thead>
              <tbody>
                {worlds.map((w, i) => (
                  <tr key={w.id} className={`border-t border-border/60 text-ink ${viewing?.id === w.id ? "bg-accent-bg" : ""}`}>
                    <td className="px-1 py-1 text-muted">{i + 1}</td>
                    <td className="px-1 py-1">{STRATEGIES.find((s) => s.key === w.strategy)?.label ?? w.strategy}</td>
                    <td className="px-1 py-1 text-right tabular-nums">{money(w.basePnl)}</td>
                    <td className="px-1 py-1 text-right tabular-nums">{money(w.worstPnl)}</td>
                    <td className="px-1 py-1 text-right tabular-nums text-danger">{money(w.worstPnl - w.basePnl)}</td>
                    <td className="px-1 py-1">
                      <button type="button" onClick={() => { setViewing(w); setHover(null); }} className="text-accent hover:text-accent-dim transition-colors">seed {w.seed} ↗</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {viewing && (
            <button type="button" onClick={() => setViewing(null)} className="mt-2 px-1 font-mono text-[0.62rem] text-muted hover:text-ink transition-colors">← back to the live run</button>
          )}
        </div>
      </div>

      {/* controls + verdict */}
      <div className="space-y-6">
        <div className="card-soft p-5">
          <p className="font-mono text-fluid-xs text-muted">worst P&amp;L found</p>
          <p className={`mt-2 font-sans text-[2.6rem] font-bold leading-none tracking-tight ${shownWorst ? (shownWorst.pnl < 0 ? "text-danger" : "text-ink") : "text-muted/40"}`}>
            {shownWorst ? money(shownWorst.pnl) : "—"}
          </p>
          <dl className="mt-4 space-y-2 font-mono text-fluid-xs">
            <div className="flex justify-between gap-3"><dt className="text-muted">on the original tape</dt><dd className="text-ink">{shownBase ? money(shownBase.pnl) : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">damage from reordering time</dt><dd className={damage !== null && damage < 0 ? "text-danger" : "text-ink"}>{damage !== null ? money(damage) : "—"}</dd></div>
            {progress && <div className="flex justify-between gap-3"><dt className="text-muted">iteration</dt><dd className="text-ink">{progress.iter} / {iters}</dd></div>}
          </dl>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={attack} disabled={running}
                    className="flex-1 rounded-lg bg-accent px-4 py-2 font-display text-fluid-sm font-semibold text-white transition-all hover:bg-accent-dim disabled:opacity-50">
              {phase === "loading" ? "loading engine…" : phase === "running" ? "attacking…" : phase === "done" ? "attack again" : "attack"}
            </button>
            {running && (
              <button type="button" onClick={worker.stop} className="rounded-lg border border-border px-3 py-2 font-display text-fluid-sm text-muted hover:text-ink transition-colors">stop</button>
            )}
          </div>
          {error && <p className="mt-3 font-mono text-[0.62rem] text-danger break-words">{error}</p>}
          <p className="mt-4 font-mono text-[0.6rem] leading-relaxed text-muted/70">
            athenas-pallas 5.0.1 · wasm32-wasip1 · runs in this tab · endpoints pinned · |daily move| ≤ 6% · vol ≤ {volCap.toFixed(2)}× original
          </p>
        </div>

        <div className="card-soft p-5 space-y-4">
          <div>
            <p className="font-mono text-fluid-xs text-muted mb-2">strategy under attack</p>
            <div className="grid grid-cols-2 gap-1.5">
              {STRATEGIES.map((s) => (
                <button key={s.key} type="button" onClick={() => setStrategy(s.key)} disabled={running}
                        className={`rounded-md px-2 py-1.5 text-left font-mono text-[0.66rem] transition-colors ${strategy === s.key ? "bg-accent-bg text-accent-dim" : "text-muted hover:text-ink hover:bg-surface"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-[0.6rem] text-muted/70 leading-relaxed">{strat.blurb}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[0.66rem]">
            {strategy === "sma_cross" && (<>
              <label className="text-muted">fast<input type="number" min={2} max={60} value={params.fast} onChange={(e) => set("fast", +e.target.value)} disabled={running} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink" /></label>
              <label className="text-muted">slow<input type="number" min={3} max={120} value={params.slow} onChange={(e) => set("slow", +e.target.value)} disabled={running} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink" /></label>
            </>)}
            {(strategy === "momentum" || strategy === "mean_revert") && (
              <label className="text-muted">lookback<input type="number" min={2} max={120} value={params.lookback} onChange={(e) => set("lookback", +e.target.value)} disabled={running} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink" /></label>
            )}
            {strategy === "mean_revert" && (
              <label className="text-muted">z entry<input type="number" min={0.25} max={3} step={0.25} value={params.z_entry} onChange={(e) => set("z_entry", +e.target.value)} disabled={running} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink" /></label>
            )}
            <label className="text-muted">qty<input type="number" min={1} max={100} value={params.qty} onChange={(e) => set("qty", +e.target.value)} disabled={running} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink" /></label>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-[0.66rem]">
            <label className="text-muted">tape seed
              <div className="mt-1 flex gap-1">
                <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} disabled={running} className="w-full rounded border border-border bg-surface px-2 py-1 text-ink" />
                <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 100000))} disabled={running} className="chip-soft px-2 text-muted hover:text-ink">new</button>
              </div>
            </label>
            <label className="text-muted">iterations
              <select value={iters} onChange={(e) => setIters(+e.target.value)} disabled={running} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink">
                {[500, 1500, 4000, 10000].map((n) => <option key={n} value={n}>{n.toLocaleString()}</option>)}
              </select>
            </label>
            <label className="col-span-2 text-muted">volatility budget · {volCap.toFixed(2)}× the original
              <input type="range" min={1} max={2} step={0.05} value={volCap} onChange={(e) => setVolCap(+e.target.value)} disabled={running} className="mt-1 w-full accent-[var(--color-accent)]" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
