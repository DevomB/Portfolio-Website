"use client";

import { useMemo, useRef, useState } from "react";
import { m } from "framer-motion";
import { fade } from "@/app/(home)/fade";

/* The chart itself: pure UI over the points it is handed. Where the points
   come from — the live data branch or the bundled snapshot — is
   TectonixSection's business. */

export type Point = {
  sha: string;
  short: string;
  date: string;
  subject: string;
  signal: number | null;
  bottleneck: string | null;
  files?: number | null;
  lines?: number | null;
  cycles?: number | null;
  complexFunctions?: number | null;
  longFunctions?: number | null;
  deadFunctions?: number | null;
};

// plot geometry in viewBox units; the SVG scales uniformly to its container
const W = 800;
const H = 260;
const PAD = { top: 18, right: 22, bottom: 34, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// UTC on purpose: the server renders this in UTC and the browser in local
// time; without pinning the zone a commit near midnight formats to a
// different day on each side, and React reports a hydration mismatch.
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const numFmt = new Intl.NumberFormat("en-US");
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

type Props = {
  /** commits with a signal, oldest first */
  points: Point[];
  tool: string;
  branch: string;
};

export default function TectonixChart({ points, tool, branch }: Props) {
  // Everything derivable from the points is computed once per dataset, not
  // per render: the table's labels, in particular, run three Intl formats per
  // row and used to re-run on every pointer-move.
  const rows = useMemo(() => points.map((p) => ({
    ...p,
    dateLabel: fmtDate(p.date),
    signalLabel: numFmt.format(p.signal as number),
    linesLabel: p.lines != null ? numFmt.format(p.lines) : "—",
    subjectLabel: p.subject.length > 56 ? p.subject.slice(0, 55) + "…" : p.subject,
  })), [points]);
  const rowsNewestFirst = useMemo(() => [...rows].reverse(), [rows]);
  const [hover, setHover] = useState<number | null>(null);
  // the table is ~400 elements; it exists in the DOM only once someone opens it
  const [tableOpen, setTableOpen] = useState(false);
  const plotRef = useRef<SVGRectElement>(null);

  // y domain: a padded, rounded window around the data — a fixed 0–10000 axis
  // would flatten every refactor into a line you cannot read
  const { yMin, yMax, ticks } = useMemo(() => {
    if (points.length === 0) return { yMin: 0, yMax: 10000, ticks: [0, 2500, 5000, 7500, 10000] };
    const vals = points.map((p) => p.signal as number);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const span = Math.max(hi - lo, 400);
    const step = span > 2000 ? 500 : span > 800 ? 250 : 100;
    const yMin = Math.max(0, Math.floor((lo - span * 0.15) / step) * step);
    const yMax = Math.min(10000, Math.ceil((hi + span * 0.15) / step) * step);
    const ticks: number[] = [];
    for (let v = yMin; v <= yMax; v += step) ticks.push(v);
    // keep ~4-5 gridlines
    const every = Math.max(1, Math.ceil(ticks.length / 5));
    return { yMin, yMax, ticks: ticks.filter((_, i) => i % every === 0) };
  }, [points]);

  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * PLOT_W : PLOT_W / 2);
  const y = (v: number) => PAD.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H;

  const path = useMemo(
    () => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.signal as number).toFixed(1)}`).join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, yMin, yMax],
  );

  const latest = points.at(-1) ?? null;
  const prev = points.at(-2) ?? null;
  const first = points[0] ?? null;
  const active = hover !== null ? points[hover] : latest;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    // the crosshair finds the X: snap to the nearest commit
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setHover(Math.round(frac * (points.length - 1)));
  };

  const onKey = (e: React.KeyboardEvent<SVGRectElement>) => {
    if (points.length === 0) return;
    const cur = hover ?? points.length - 1;
    if (e.key === "ArrowLeft") { e.preventDefault(); setHover(Math.max(0, cur - 1)); }
    if (e.key === "ArrowRight") { e.preventDefault(); setHover(Math.min(points.length - 1, cur + 1)); }
    if (e.key === "Home") { e.preventDefault(); setHover(0); }
    if (e.key === "End") { e.preventDefault(); setHover(points.length - 1); }
  };

  const delta = (a: Point | null, b: Point | null) =>
    a && b && a.signal !== null && b.signal !== null ? (a.signal as number) - (b.signal as number) : null;
  const dPrev = delta(latest, prev);
  const dFirst = delta(latest, first);
  const signed = (d: number) => (d > 0 ? `+${d.toLocaleString()}` : d.toLocaleString());
  const prevLabel = dPrev !== null ? signed(dPrev) : null;
  const firstLabel = dFirst !== null ? signed(dFirst) : null;

  return (
    <section id="architecture" className="scroll-mt-28 section-y">
      <m.p {...fade(0)} className="font-mono text-fluid-xs text-secondary tracking-wide mb-10">
        {"// tectonix"}
      </m.p>

      <m.div {...fade(0.05)} className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16 items-start">
        {/* the chart */}
        <div>
          <h2 className="font-title text-fluid-3xl font-bold tracking-tight text-ink">
            This site, graded by a tool I built
          </h2>
          <p className="mt-3 max-w-xl text-fluid-base leading-relaxed text-muted">
            <a
              href="https://github.com/DevomB/Tectonix"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-dim transition-colors"
            >
              Tectonix
            </a>{" "}
            is a headless code-quality analyser for AI agents, written in Rust. The real
            binary is run over every commit of this repository; this is the 0–10,000
            quality signal it reports, commit by commit. Refactors move it. So do
            mistakes.
          </p>

          {points.length === 0 ? (
            <p className="mt-8 font-mono text-fluid-xs text-muted">
              history not generated yet — <span className="text-ink">pnpm tectonix:history</span>
            </p>
          ) : (
            <div className="relative mt-8">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto select-none"
                role="img"
                aria-label={`Tectonix quality signal over ${points.length} commits, latest ${latest?.signal}`}
                onPointerLeave={() => setHover(null)}
              >
                {/* recessive hairline grid + y ticks */}
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                          stroke="rgb(var(--brand-purple-rgb) / 0.14)" strokeWidth={1} />
                    <text x={PAD.left - 10} y={y(t) + 3.5} textAnchor="end"
                          fontSize={10.5} fontFamily="var(--font-mono), monospace" fill="var(--color-muted)">
                      {t.toLocaleString()}
                    </text>
                  </g>
                ))}
                {/* x: first / middle / last commit dates */}
                {[0, Math.floor((points.length - 1) / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
                  <text key={i} x={x(i)} y={H - 10} fontSize={10.5}
                        textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                        fontFamily="var(--font-mono), monospace" fill="var(--color-muted)">
                    {rows[i]!.dateLabel}
                  </text>
                ))}

                {/* the series: 2px, round joins */}
                <path d={path} fill="none" stroke="var(--color-accent-dim)" strokeWidth={2}
                      strokeLinejoin="round" strokeLinecap="round" />

                {/* end marker: r4 + 2px surface ring */}
                {latest && (
                  <circle cx={x(points.length - 1)} cy={y(latest.signal as number)} r={4}
                          fill="var(--color-accent-dim)" stroke="var(--color-bg)" strokeWidth={2} />
                )}

                {/* crosshair + hovered marker */}
                {hover !== null && active && (
                  <g>
                    <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + PLOT_H}
                          stroke="rgb(var(--brand-purple-rgb) / 0.35)" strokeWidth={1} />
                    <circle cx={x(hover)} cy={y(active.signal as number)} r={5}
                            fill="var(--color-secondary)" stroke="var(--color-bg)" strokeWidth={2} />
                  </g>
                )}

                {/* hit layer — the whole plot, keyboard-reachable */}
                <rect
                  ref={plotRef}
                  x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H}
                  fill="transparent"
                  tabIndex={0}
                  aria-label="Move across commits with the arrow keys"
                  onPointerMove={onMove}
                  onPointerDown={onMove}
                  onKeyDown={onKey}
                  onBlur={() => setHover(null)}
                  style={{ cursor: "crosshair", outline: "none" }}
                />
              </svg>

              {/* tooltip: value leads, label follows */}
              {hover !== null && active && (
                <div
                  className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-accent/25 bg-surface px-3 py-2 shadow-card"
                  style={{
                    left: `${(x(hover) / W) * 100}%`,
                    top: 0,
                    maxWidth: 260,
                  }}
                >
                  <p className="font-sans text-fluid-base font-semibold text-ink leading-none">
                    {(active.signal as number).toLocaleString()}
                    <span className="ml-1.5 font-mono text-[0.6rem] font-normal text-muted">/ 10,000</span>
                  </p>
                  <p className="mt-1.5 text-fluid-xs text-ink leading-snug">{active.subject}</p>
                  <p className="mt-1 font-mono text-[0.6rem] text-muted">
                    {active.short} · {rows[hover ?? rows.length - 1]!.dateLabel}
                    {active.bottleneck ? ` · bottleneck ${active.bottleneck}` : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* table view — every value reachable without hovering */}
          {points.length > 0 && (
            <details className="mt-4 group" onToggle={(e) => setTableOpen(e.currentTarget.open)}>
              <summary className="cursor-pointer font-mono text-fluid-xs text-muted hover:text-ink transition-colors">
                table view · {points.length} commits
              </summary>
              {tableOpen && (
              <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full font-mono text-[0.68rem]">
                  <thead>
                    <tr className="text-left text-muted">
                      <th className="px-3 py-2 font-normal">commit</th>
                      <th className="px-3 py-2 font-normal">date</th>
                      <th className="px-3 py-2 font-normal text-right">signal</th>
                      <th className="px-3 py-2 font-normal">bottleneck</th>
                      <th className="px-3 py-2 font-normal text-right">files</th>
                      <th className="px-3 py-2 font-normal text-right">lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsNewestFirst.map((p) => (
                      <tr key={p.sha} className="border-t border-border/60 text-ink">
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="text-muted">{p.short}</span>{" "}
                          <span className="text-ink">{p.subjectLabel}</span>
                        </td>
                        <td className="px-3 py-1.5 text-muted whitespace-nowrap">{p.dateLabel}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{p.signalLabel}</td>
                        <td className="px-3 py-1.5 text-muted">{p.bottleneck ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted">{p.files ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted">{p.linesLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </details>
          )}
        </div>

        {/* the hero figure */}
        {latest && (
          <div className="card-soft p-6">
            <p className="font-mono text-fluid-xs text-muted">quality signal · latest commit</p>
            <p className="mt-2 font-sans text-[3.25rem] font-bold leading-none tracking-tight text-ink">
              {(latest.signal as number).toLocaleString()}
            </p>
            <p className="mt-1 font-mono text-[0.62rem] text-muted">of 10,000</p>

            <dl className="mt-6 space-y-3 font-mono text-fluid-xs">
              {dPrev !== null && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">vs previous commit</dt>
                  <dd className={dPrev >= 0 ? "text-secondary-dim" : "text-danger"}>{prevLabel}</dd>
                </div>
              )}
              {dFirst !== null && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">vs first commit</dt>
                  <dd className={dFirst >= 0 ? "text-secondary-dim" : "text-danger"}>{firstLabel}</dd>
                </div>
              )}
              {latest.bottleneck && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">bottleneck</dt>
                  <dd className="text-ink">{latest.bottleneck}</dd>
                </div>
              )}
              {typeof latest.files === "number" && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted">files · lines</dt>
                  <dd className="text-ink">{latest.files} · {latest.lines?.toLocaleString()}</dd>
                </div>
              )}
            </dl>

            <p className="mt-6 font-mono text-[0.6rem] leading-relaxed text-muted/70">
              {tool} · {points.length} commits · {branch}
            </p>
          </div>
        )}
      </m.div>
    </section>
  );
}
