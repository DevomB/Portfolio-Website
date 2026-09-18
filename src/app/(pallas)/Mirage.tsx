"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/app/(chrome)/Button";
import { Slider } from "@/app/(chrome)/Slider";
import { useWidth } from "@/app/(chrome)/useWidth";
import { useRem } from "@/app/(chrome)/useRem";
import LineChart from "./LineChart";
import { clamp } from "@/lib/num";
import { labelOn, oklchLuminance } from "@/lib/color";
import { money, sharpeFmt } from "./format";
import { useEngineWorker } from "./useEngineWorker";
import {
  FAMILIES, INITIAL_BALANCE, IS_BARS, OOS_BARS, PHI_MAX, WORLDS, gridCells, gridShape, phiOf,
  type CellScore, type Family, type Metric, type MirageDone, type MirageMessage, type MirageProgress, type MirageStart, type WalkFold, type WorldKind,
} from "./worlds";

/* The Mirage.
   The engine (Athena's Pallas, WASI build) runs in a Web Worker. This page
   owns the world and grid controls, the live heat map, the noise strip, the
   held-out equity chart and the verdict. Every score on screen was read off
   the engine's own equity curve over a stated bar window. */

const fmt = (metric: Metric, v: number) => (metric === "pnl" ? money(v) : sharpeFmt(v));

// procedures: colour on the heat map marks, in the table and on the equity chart; purple is the buy-and-hold reference
const PEAK = "#f2f2f2", PLATEAU = "#1fb14a", WALK = "#febc2e", HOLD = "#a35cff";

/** sequential single-hue ramp (purple, dark→light) for a 0..1 score rank:
 *  the fill, and the luminance its cell label is chosen against */
const rampL = (t: number) => (26 + 52 * clamp(t, 0, 1)) / 100;
const rampC = (t: number) => 0.12 + 0.08 * t;
const ramp = (t: number) => `oklch(${(rampL(t) * 100).toFixed(1)}% ${rampC(t).toFixed(3)} 300)`;

// The charts draw at their shown width, one unit to a pixel, and size the
// rest in rem: every label is 0.6875rem Geist Mono (11px at a 16px root),
// about 0.6 of that an advance. `k` is px per rem over 16.
const FONT = 11;
const ADVANCE = 6.6;
const textWidth = (label: string, k: number) => label.length * ADVANCE * k;

// ── the heat map ───────────────────────────────────────────────────────────
function HeatMap({ family, grid, metric, peak, plateau, walk, hover, onHover }: {
  family: Family;
  grid: (CellScore | null)[];
  metric: Metric;
  peak: number | null;
  plateau: number | null;
  walk: WalkFold[];
  hover: number | null;
  onHover: (i: number | null) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap, 760);
  const k = useRem() / 16;
  const spec = FAMILIES[family];
  const { nx, ny } = gridShape(family);
  const L = 56 * k, B = 34 * k, T = 8 * k, R = 8 * k;
  const cw = (W - L - R) / nx;
  const ch = Math.min(46 * k, Math.max(30 * k, cw * 0.62));
  const H = T + ny * ch + B;
  const scores = grid.map((s) => (s ? (metric === "pnl" ? s.pnl : s.sharpe) : null));
  const known = scores.filter((s): s is number => s !== null);
  const lo = known.length ? Math.min(...known) : 0, hi = known.length ? Math.max(...known) : 1;
  const span = Math.max(hi - lo, 1e-9);
  const cells = gridCells(family);
  const picksAt = (i: number) => walk.filter((f) => f.pick === i).map((f) => f.fold);
  // a narrow column shows every other x value rather than overlapping them
  const xStep = Math.max(1, Math.ceil((Math.max(...spec.x.values.map((v) => textWidth(String(v), k))) + 6 * k) / cw));
  return (
    <div ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto select-none" role="img" aria-label={`In-sample sweep of ${cells.length} parameter sets`} onPointerLeave={() => onHover(null)}>
        {cells.map((c) => {
          const s = scores[c.index];
          const x = L + c.xi * cw, y = T + (ny - 1 - c.yi) * ch;
          const t = s === null ? 0 : (s - lo) / span;
          const label = s === null ? "" : metric === "pnl" ? (s >= 0 ? "+" : "−") + Math.abs(Math.round(s)).toLocaleString("en-US") : sharpeFmt(s);
          return (
            <g key={c.index} onPointerEnter={() => onHover(c.index)}>
              <rect x={x + 1} y={y + 1} width={cw - 2} height={ch - 2} rx={3}
                    fill={s === null ? "rgb(var(--brand-purple-rgb) / 0.06)" : ramp(t)}
                    stroke={hover === c.index ? "var(--color-secondary)" : "none"} strokeWidth={1.5} />
              {/* the value when it fits its cell; otherwise it is in the tooltip and the table */}
              {s !== null && textWidth(label, k) + 8 * k <= cw && (
                <text x={x + cw / 2} y={y + ch / 2 + 4 * k} textAnchor="middle" fontSize={FONT * k} fontFamily="var(--font-mono), monospace"
                      fill={labelOn(oklchLuminance(rampL(t), rampC(t), 300))}>{label}</text>
              )}
            </g>
          );
        })}
        {/* marks: peak, plateau, walk-forward folds */}
        {cells.map((c) => {
          const x = L + c.xi * cw, y = T + (ny - 1 - c.yi) * ch;
          const folds = picksAt(c.index);
          const badge = textWidth(folds.join(""), k) + 6 * k;
          return (
            <g key={`m${c.index}`} pointerEvents="none">
              {plateau === c.index && <rect x={x + 2.5} y={y + 2.5} width={cw - 5} height={ch - 5} rx={3} fill="none" stroke={PLATEAU} strokeWidth={2} strokeDasharray="4 3" />}
              {peak === c.index && <rect x={x + 2.5} y={y + 2.5} width={cw - 5} height={ch - 5} rx={3} fill="none" stroke={PEAK} strokeWidth={2} />}
              {folds.length > 0 && (badge + 8 * k <= cw ? (
                <g>
                  <rect x={x + 4 * k} y={y + 4 * k} width={badge} height={14 * k} rx={2 * k} fill={WALK} />
                  <text x={x + 4 * k + badge / 2} y={y + 15 * k} textAnchor="middle" fontSize={FONT * k} fontWeight={700} fontFamily="var(--font-mono), monospace" fill="#141414">{folds.join("")}</text>
                </g>
              ) : (
                <rect x={x + 4 * k} y={y + 4 * k} width={8 * k} height={8 * k} rx={2 * k} fill={WALK} />
              ))}
            </g>
          );
        })}
        {/* axes */}
        {spec.x.values.map((v, xi) => xi % xStep === 0 && (
          <text key={`x${xi}`} x={L + xi * cw + cw / 2} y={H - 18 * k} textAnchor="middle" fontSize={FONT * k} fontFamily="var(--font-mono), monospace" fill="var(--color-muted)">{v}</text>
        ))}
        <text x={L + (W - L - R) / 2} y={H - 3 * k} textAnchor="middle" fontSize={FONT * k} fontFamily="var(--font-mono), monospace" fill="var(--color-muted)">{spec.x.label}</text>
        {spec.y && spec.y.values.map((v, yi) => (
          <text key={`y${yi}`} x={L - 8 * k} y={T + (ny - 1 - yi) * ch + ch / 2 + 4 * k} textAnchor="end" fontSize={FONT * k} fontFamily="var(--font-mono), monospace" fill="var(--color-muted)">{v}</text>
        ))}
        {spec.y && (
          <text x={10 * k} y={T + (ny * ch) / 2} textAnchor="middle" fontSize={FONT * k} fontFamily="var(--font-mono), monospace" fill="var(--color-muted)" transform={`rotate(-90 ${10 * k} ${T + (ny * ch) / 2})`}>{spec.y.label}</text>
        )}
      </svg>
    </div>
  );
}

// ── the noise strip ────────────────────────────────────────────────────────
function NoiseStrip({ values, observed, metric }: { values: number[]; observed: number | null; metric: Metric }) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap, 760);
  const k = useRem() / 16;
  const H = 70 * k, L = 16 * k, R = 16 * k;
  const all = [...values, ...(observed !== null ? [observed] : [])];
  const lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1;
  const span = Math.max(hi - lo, 1e-9);
  const x = (v: number) => L + ((v - lo) / span) * (W - L - R);
  // a centred label slides inward rather than running off either edge
  const centred = (v: number, label: string) => clamp(x(v), textWidth(label, k) / 2 + 2 * k, W - textWidth(label, k) / 2 - 2 * k);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : null;
  const luck = median !== null ? `luck, typically ${fmt(metric, median)}` : "";
  const mine = observed !== null ? `your peak ${fmt(metric, observed)}` : "";
  return (
    <div ref={wrap}>
      {all.length === 0 ? (
        <p className="px-1 font-mono text-fluid-xs text-muted">shuffled worlds appear here as they finish</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label="Best in-sample score in each shuffled world, against the observed best">
          <line x1={L} x2={W - R} y1={34 * k} y2={34 * k} stroke="rgb(var(--brand-purple-rgb) / 0.25)" strokeWidth={1} />
          {values.map((v, i) => (
            <circle key={i} cx={x(v)} cy={(34 + ((i % 5) - 2) * 3) * k} r={4 * k} fill={WALK} fillOpacity={0.55} />
          ))}
          {median !== null && (
            <g>
              <line x1={x(median)} x2={x(median)} y1={20 * k} y2={48 * k} stroke="var(--color-muted)" strokeWidth={1} strokeDasharray="2 3" />
              <text x={centred(median, luck)} y={65 * k} textAnchor="middle" fontSize={FONT * k} fontFamily="var(--font-mono), monospace" fill="var(--color-muted)">{luck}</text>
            </g>
          )}
          {observed !== null && (
            <g>
              <line x1={x(observed)} x2={x(observed)} y1={14 * k} y2={54 * k} stroke={PEAK} strokeWidth={2 * k} />
              <text x={centred(observed, mine)} y={10 * k} textAnchor="middle" fontSize={FONT * k} fontFamily="var(--font-mono), monospace" fill="var(--color-ink)">{mine}</text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

export default function Mirage() {
  const [kind, setKind] = useState<WorldKind>("noise");
  const [strength, setStrength] = useState(0.6);
  const [seed, setSeed] = useState(11);
  const [family, setFamily] = useState<Family>("sma_cross");
  const [metric, setMetric] = useState<Metric>("pnl");
  const [permutations, setPermutations] = useState(8);

  const [phase, setPhase] = useState<"idle" | "loading" | "running" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<MirageProgress | null>(null);
  const [result, setResult] = useState<MirageDone | null>(null);
  const [ran, setRan] = useState<{ family: Family; metric: Metric; kind: WorldKind; strength: number; seed: number } | null>(null);
  const [cellHover, setCellHover] = useState<number | null>(null);
  const [chartHover, setChartHover] = useState<number | null>(null);
  const worker = useEngineWorker<MirageMessage>(() => new Worker(new URL("./mirage.worker.ts", import.meta.url), { type: "module" }));

  const run = () => {
    setError(null); setProgress(null); setResult(null); setCellHover(null);
    setRan({ family, metric, kind, strength, seed });
    setPhase("loading");
    const start: MirageStart = { type: "start", seed, kind, strength, family, metric, permutations, qty: 50 };
    worker.start(start, (m) => {
      if (m.type === "ready" || m.type === "world") { setPhase("running"); return; }
      if (m.type === "progress") { setPhase("running"); setProgress(m); return; }
      if (m.type === "error") { setError(m.message === "stopped" ? null : m.message); setPhase("idle"); return; }
      if (m.type === "done") { setResult(m); setPhase("done"); }
    });
  };
  const running = phase === "loading" || phase === "running";

  // what the panels show: the finished result, else the live progress
  const shownFamily = ran?.family ?? family;
  const shownMetric = ran?.metric ?? metric;
  const grid: (CellScore | null)[] = result?.grid ?? progress?.grid ?? new Array(gridCells(shownFamily).length).fill(null);
  const walk = result?.walk ?? progress?.walk ?? [];
  const noiseMax = result?.noiseMax ?? progress?.noiseMax ?? [];
  const cells = useMemo(() => gridCells(shownFamily), [shownFamily]);
  const scoreOf = (s: CellScore) => (shownMetric === "pnl" ? s.pnl : s.sharpe);
  const ranks = useMemo(() => {
    const known = grid.map((s, i) => ({ s: s ? scoreOf(s) : -Infinity, i })).sort((a, b) => b.s - a.s);
    const r = new Array<number>(grid.length);
    known.forEach((k, idx) => { r[k.i] = idx + 1; });
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, shownMetric]);
  const peakScore = result ? scoreOf(result.grid[result.peak]!) : null;
  const hovered = cellHover !== null ? { cell: cells[cellHover]!, score: grid[cellHover] } : null;

  const phaseLabel = progress ? { sweep: "sweeping the grid in-sample", walk: "walking forward through the held-out year", noise: "shuffling the world", holdout: "grading the picks on the held-out year" }[progress.phase] : "";
  const p = result?.pValue ?? null;
  const spec = FAMILIES[shownFamily];
  const worldLabel = (k: WorldKind, s: number) => (k === "noise" ? "noise" : `${WORLDS.find((w) => w.key === k)!.label}, φ = ${phiOf(k, s).toFixed(2)}`);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18.75rem]">
      <div className="min-w-0 space-y-6">
        {/* ── the grid ── */}
        <div className="card-soft p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1 pb-2">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-fluid-xs text-muted">
              <span>in-sample · {cells.length} parameter sets · {IS_BARS} bars · {shownMetric === "pnl" ? "P&L" : "Sharpe"}</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm border-2" style={{ borderColor: PEAK }} />peak</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm border-2 border-dashed" style={{ borderColor: PLATEAU }} />plateau</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: WALK }} />walk-forward pick, by quarter</span>
            </p>
            <p className="font-mono text-fluid-xs text-muted">
              {progress && running ? `${phaseLabel} · ${progress.done}/${progress.total} · ${Math.round(progress.evalsPerSec)} backtests/s` : result ? `${result.evals.toLocaleString()} backtests · ${(result.ms / 1000).toFixed(1)} s · in this tab` : "run to sweep"}
            </p>
          </div>
          <div className="relative">
            <HeatMap family={shownFamily} grid={grid} metric={shownMetric} peak={result?.peak ?? null} plateau={result?.plateau ?? null} walk={walk} hover={cellHover} onHover={setCellHover} />
            {hovered && hovered.score && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-accent/25 bg-surface px-3 py-2 shadow-card">
                <p className="font-sans text-fluid-lg font-semibold leading-none text-ink">
                  {fmt(shownMetric, scoreOf(hovered.score))}
                  <span className="ml-2 font-mono text-fluid-xs font-normal text-muted">{hovered.cell.label}</span>
                </p>
                <p className="mt-1 font-mono text-fluid-xs text-muted">
                  #{ranks[cellHover!]} of {cells.length} · P&L {money(hovered.score.pnl)} · Sharpe {sharpeFmt(hovered.score.sharpe)} · {hovered.score.trades} trades
                  {result?.peak === cellHover ? " · the peak" : ""}{result?.plateau === cellHover ? " · the plateau" : ""}
                  {walk.some((f) => f.pick === cellHover) ? ` · walk-forward Q${walk.filter((f) => f.pick === cellHover).map((f) => f.fold).join(", Q")}` : ""}
                </p>
              </div>
            )}
            {error && <p className="absolute right-3 top-3 font-mono text-fluid-xs text-danger">{error}</p>}
          </div>
        </div>

        {/* ── held-out year ── */}
        <div className="card-soft p-4">
          <p className="font-mono text-fluid-xs text-muted px-1 pb-2">held-out year · {OOS_BARS} bars the picks never saw · equity from {money(INITIAL_BALANCE).slice(1)}</p>
          <LineChart id="holdout-chart" height={200}
                     series={[result?.holdout.peak.equity ?? null, result?.holdout.plateau.equity ?? null, result?.holdout.walk.equity ?? null, result?.holdout.hold.equity ?? null]}
                     labels={["peak", "plateau", "walk-forward", "buy & hold (reference)"]} colors={[PEAK, PLATEAU, WALK, HOLD]} baseline={INITIAL_BALANCE}
                     hover={chartHover} onHover={setChartHover} format={(v) => "$" + Math.round(v).toLocaleString("en-US")}
                     empty="the three picks are graded here once the sweep finishes" />
          {result && <p className="mt-2 px-1 font-mono text-fluid-xs text-muted">buy &amp; hold is what simply being long made this year — a pick that cannot beat it found nothing</p>}
        </div>

        {/* ── the noise test ── */}
        <div className="card-soft p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1 pb-1">
            <p className="font-mono text-fluid-xs text-muted">shuffled worlds · the same in-sample returns in a random order, the whole grid re-swept, the best cell kept</p>
            <p className="font-mono text-fluid-xs text-muted">{noiseMax.length} of {ran ? permutations : permutations} worlds</p>
          </div>
          <NoiseStrip values={noiseMax} observed={peakScore} metric={shownMetric} />
          {p !== null && result && (
            <p className="mt-1 px-1 font-mono text-fluid-xs text-muted">
              p = {p.toFixed(2)} · {noiseMax.filter((v) => v >= peakScore!).length} of {noiseMax.length} worlds with nothing in them beat your peak
              {" · "}p = (1 + that count) / (worlds + 1)
            </p>
          )}
        </div>

        {/* ── every cell ── */}
        {result && (
          <details className="card-soft p-4">
            <summary className="cursor-pointer font-mono text-fluid-xs text-muted hover:text-ink">every cell of the sweep, ranked</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full font-mono text-fluid-xs">
                <thead><tr className="text-left text-muted"><th className="px-1 py-1 font-normal">#</th><th className="px-1 py-1 font-normal">parameters</th><th className="px-1 py-1 font-normal text-right">in-sample P&L</th><th className="px-1 py-1 font-normal text-right">Sharpe</th><th className="px-1 py-1 font-normal text-right">trades</th><th className="px-1 py-1 font-normal">picked by</th></tr></thead>
                <tbody>
                  {cells.map((c) => ({ c, s: result.grid[c.index]! })).sort((a, b) => scoreOf(b.s) - scoreOf(a.s)).map(({ c, s }, i) => (
                    <tr key={c.index} className="border-t border-border/60 text-ink">
                      <td className="px-1 py-1 text-muted">{i + 1}</td>
                      <td className="px-1 py-1">{c.label}</td>
                      <td className="px-1 py-1 text-right tabular-nums">{money(s.pnl)}</td>
                      <td className="px-1 py-1 text-right tabular-nums">{sharpeFmt(s.sharpe)}</td>
                      <td className="px-1 py-1 text-right tabular-nums">{s.trades}</td>
                      <td className="px-1 py-1 text-muted">
                        {[result.peak === c.index ? "peak" : null, result.plateau === c.index ? "plateau" : null, ...walk.filter((f) => f.pick === c.index).map((f) => `Q${f.fold}`)].filter(Boolean).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      {/* ── verdict + controls ── */}
      <div className="min-w-0 space-y-6">
        <div className="card-soft p-5">
          <p className="font-mono text-fluid-xs text-muted">the in-sample peak, held out</p>
          <p className={`mt-2 font-sans text-[2.4rem] font-bold leading-none tracking-tight ${result ? (result.holdout.peak.pnl < 0 ? "text-danger" : "text-ink") : "text-muted"}`}>
            {result ? money(result.holdout.peak.pnl) : "—"}
          </p>
          {result && (
            <p className="mt-2 font-mono text-fluid-xs text-muted">
              after showing {money(result.grid[result.peak]!.pnl)} in-sample · {cells[result.peak]!.label}
            </p>
          )}
          {result && (
            <table className="mt-4 w-full font-mono text-fluid-xs">
              <thead><tr className="text-left text-muted"><th className="py-1 font-normal">procedure</th><th className="py-1 font-normal text-right">in-sample</th><th className="py-1 font-normal text-right">held out</th></tr></thead>
              <tbody>
                {([
                  ["peak", PEAK, money(result.grid[result.peak]!.pnl), result.holdout.peak.pnl],
                  ["plateau", PLATEAU, money(result.grid[result.plateau]!.pnl), result.holdout.plateau.pnl],
                  ["walk-forward", WALK, "re-picked ×4", result.holdout.walk.pnl],
                  ["buy & hold", HOLD, "reference", result.holdout.hold.pnl],
                ] as const).map(([name, color, ins, out]) => (
                  <tr key={name} className="border-t border-border/60 text-ink">
                    <td className="py-1"><span className="mr-1.5 inline-block h-[2px] w-3 rounded align-middle" style={{ background: color }} />{name}</td>
                    <td className="py-1 text-right tabular-nums text-muted">{ins}</td>
                    <td className={`py-1 text-right tabular-nums ${out < 0 ? "text-danger" : ""}`}>{money(out)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result && p !== null && (
            <p className="mt-4 font-mono text-fluid-xs leading-relaxed text-muted">
              {p > 0.1
                ? <>Luck alone produces a peak this good in <span className="text-ink">{Math.round(p * 100)}%</span> of shuffled worlds. The peak is a mirage; the held-out year is where it evaporates.</>
                : p > 0.05
                  ? <>Only <span className="text-ink">{Math.round(p * 100)}%</span> of shuffled worlds match this peak — suggestive, not proof. The held-out year decides.</>
                  : <>Only <span className="text-ink">{Math.round(p * 100)}%</span> of shuffled worlds match this peak. Something is in this world — the held-out year says whether the picks found it.</>}
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <Button onClick={run} disabled={running} className="flex-1">
              {phase === "loading" ? "loading engine…" : phase === "running" ? "sweeping…" : phase === "done" ? "run again" : "run the experiment"}
            </Button>
            {running && <Button variant="ghost" onClick={worker.stop}>stop</Button>}
          </div>
          <p className="mt-4 font-mono text-fluid-xs leading-relaxed text-muted">
            athenas-pallas 5.0.1 · wasm32-wasip1 · {ran ? `${FAMILIES[ran.family].label} on ${worldLabel(ran.kind, ran.strength)}, seed ${ran.seed}` : "nothing run yet"} · qty 50 · balance {money(INITIAL_BALANCE).slice(1)}
          </p>
        </div>

        <div className="card-soft p-5 space-y-4">
          <div>
            <p className="font-mono text-fluid-xs text-muted mb-2">the world</p>
            <div className="grid grid-cols-3 gap-1.5">
              {WORLDS.map((w) => (
                <button key={w.key} type="button" onClick={() => setKind(w.key)} disabled={running}
                        className={`rounded-md px-2 py-1.5 text-left font-mono text-fluid-xs transition-colors ${kind === w.key ? "bg-accent-bg text-accent-dim" : "text-muted hover:text-ink hover:bg-surface"}`}>
                  {w.label}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-fluid-xs text-muted leading-relaxed">{WORLDS.find((w) => w.key === kind)!.blurb}</p>
            <label className="mt-3 block font-mono text-fluid-xs text-muted">
              signal strength · φ = {phiOf(kind, strength).toFixed(2)} of ±{PHI_MAX}
              <Slider min={0} max={1} step={0.05} value={strength} onChange={(e) => setStrength(+e.target.value)} disabled={running || kind === "noise"} className="mt-1 w-full" />
              <span className="block text-fluid-xs text-muted">log-returns r = φ·r₋₁ + ε · same volatility in every world</span>
            </label>
          </div>

          <div>
            <p className="font-mono text-fluid-xs text-muted mb-2">strategy family</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(FAMILIES) as Family[]).map((k) => (
                <button key={k} type="button" onClick={() => setFamily(k)} disabled={running}
                        className={`rounded-md px-2 py-1.5 text-left font-mono text-fluid-xs transition-colors ${family === k ? "bg-accent-bg text-accent-dim" : "text-muted hover:text-ink hover:bg-surface"}`}>
                  {FAMILIES[k].label}
                </button>
              ))}
            </div>
            <p className="mt-2 font-mono text-fluid-xs text-muted leading-relaxed">{spec.blurb} · grid {FAMILIES[family].x.label} × {FAMILIES[family].y?.label ?? "—"} · {gridCells(family).length} cells</p>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 font-mono text-fluid-xs">
            <label className="text-muted">select by
              <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)} disabled={running} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink">
                <option value="pnl">P&L</option>
                <option value="sharpe">Sharpe</option>
              </select>
            </label>
            <label className="text-muted">shuffled worlds
              <select value={permutations} onChange={(e) => setPermutations(+e.target.value)} disabled={running} className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-ink">
                {[8, 16, 32, 64].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="col-span-2 text-muted">world seed
              <div className="mt-1 flex gap-1">
                <input type="number" value={seed} onChange={(e) => setSeed(+e.target.value)} disabled={running} className="w-full rounded border border-border bg-surface px-2 py-1 text-ink" />
                <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 100000))} disabled={running} className="chip-soft px-2 text-muted hover:text-ink">new</button>
              </div>
            </label>
          </div>
          <p className="font-mono text-fluid-xs leading-relaxed text-muted">
            in-sample: bars 1–{IS_BARS}. held out: bars {IS_BARS + 1}–{IS_BARS + OOS_BARS}, each pick warmed up on the 250 bars before. walk-forward re-picks each quarter on the trailing 250 bars.
          </p>
        </div>
      </div>
    </div>
  );
}
