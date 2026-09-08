"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Terrain, { type TriFill } from "@/app/(poker)/Terrain";
import BoardPicker from "@/app/(poker)/BoardPicker";
import RangePainter, { paintPreset } from "@/app/(poker)/RangePainter";
import { cellOf, classLabel } from "@/app/(poker)/handMatrix";
import { clamp } from "@/lib/num";

/* The Landscape.
   169 starting hands as an isometric terrain: height is equity on the
   current board against the opponent you choose — the range you paint
   (heads-up, exact on the river) or N random hands — computed by the
   poker-calculations engine through /api/poker/landscape. A new board or a
   new brush stroke tweens the surface from the old heights to the new ones;
   every deformation is a real change in equity, never sampling noise (the
   API is seeded per request shape). */

type Opponent = 1 | 2 | 3 | "range";
type Quote = {
  equities: (number | null)[];
  board: string[];
  villains: Opponent;
  iters: number;
  engine: "native" | "js";
  method: "mc-random" | "mc-range" | "exact-range";
  threads: number;
  rangeCombos: number | null;
  ms: number;
  cached: boolean;
};


/** sequential single-hue ramp (purple, dark→light) for 0..1 — text never wears it */
function ramp(t: number, shade: number): string {
  const L = 0.28 + 0.5 * clamp(t, 0, 1);         // OKLCH-ish lightness proxy
  const l = clamp(L * (0.75 + 0.35 * shade), 0, 1);
  const c = 0.16 + 0.1 * t;
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} 300)`;
}

export default function Landscape() {
  const [board, setBoard] = useState<string[]>([]);
  // the API prices 0, 3, 4 or 5 cards; while a flop is being picked one card at
  // a time, the terrain stays on the last complete board
  const boardForApi = useMemo(() => (board.length < 3 ? [] : board), [board]);
  const [opponent, setOpponent] = useState<Opponent>("range");
  const [range, setRange] = useState<boolean[]>(() => paintPreset("top25"));
  const [quote, setQuote] = useState<{ key: string; data: Quote } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const rangeW = useMemo(() => range.map((b) => (b ? 1 : 0)), [range]);
  const request = useMemo(
    () => ({ board: boardForApi, villains: opponent, ...(opponent === "range" ? { range: rangeW } : {}) }),
    [boardForApi, opponent, rangeW],
  );
  const requestKey = useMemo(() => JSON.stringify(request), [request]);
  const ready = opponent !== "range" || rangeW.some((w) => w > 0);
  const pending = !quote || quote.key !== requestKey;

  // fetch equities for the current board / opponent / brush — debounced so a
  // drag across the painter prices once it settles
  useEffect(() => {
    if (!ready) return;
    const ac = new AbortController();
    const key = requestKey;
    const t = setTimeout(() => {
      fetch("/api/poker/landscape", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: ac.signal,
      })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
          setError(null);
          setQuote({ key, data: data as Quote });
        })
        .catch((e: unknown) => {
          if ((e as Error).name === "AbortError") return;
          setError((e as Error).message);
        });
    }, 150);
    return () => { clearTimeout(t); ac.abort(); };
  }, [request, requestKey, ready]);

  const data = quote?.data ?? null;
  const target = useMemo(() => Float32Array.from({ length: 169 }, (_, k) => data?.equities[k] ?? 0), [data]);

  const triFill = useCallback<TriFill>(
    (p, q, r, mean, shade) => {
      const dead = data ? data.equities[p] === null || data.equities[q] === null || data.equities[r] === null : false;
      return dead ? "rgb(var(--brand-purple-rgb) / 0.08)" : ramp(mean, shade);
    },
    [data],
  );

  // ranked list for the tooltip
  const ranks = useMemo(() => {
    if (!data) return null;
    const order = data.equities.map((e, k) => ({ e: e ?? -1, k })).sort((a, b) => b.e - a.e);
    const r = new Array<number>(169);
    order.forEach((o, idx) => { r[o.k] = idx + 1; });
    return r;
  }, [data]);

  const hoverCell = hover !== null ? cellOf(hover) : null;
  const hoverEq = hover !== null && data ? data.equities[hover] : null;
  const versus = opponent === "range" ? "the painted range" : `${opponent} random hand${opponent > 1 ? "s" : ""}`;
  const methodLabel = data
    ? data.method === "exact-range"
      ? `exact vs ${data.rangeCombos} combos`
      : data.method === "mc-range"
        ? `${data.iters} sampled showdowns per hand vs ${data.rangeCombos} combos`
        : `${data.iters} iters/hand · ${data.threads} threads`
    : "";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      {/* ── terrain ── */}
      <div className="card-soft p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-2">
          <p className="font-mono text-fluid-xs text-muted">
            equity vs{" "}
            <span className="inline-flex gap-1">
              {(["range", 1, 2, 3] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOpponent(o)}
                  className={`rounded px-1.5 py-0.5 transition-colors ${opponent === o ? "bg-accent-bg text-accent-dim" : "text-muted hover:text-ink"}`}
                >
                  {o === "range" ? "the painted range" : o}
                </button>
              ))}
            </span>{" "}
            {opponent === "range" ? "" : `random opponent${opponent > 1 ? "s" : ""}`} · drag to rotate
          </p>
          <p className="font-mono text-[0.6rem] text-muted/70">
            {data
              ? `${data.engine === "native" ? "C++ engine" : "js fallback"} · ${methodLabel} · ${data.cached ? "cached" : `${data.ms} ms`}`
              : "pricing…"}
          </p>
        </div>

        <Terrain
          target={target}
          triFill={triFill}
          hover={hover}
          onHover={setHover}
          pending={pending}
          ariaLabel={`Equity terrain over 169 starting hands vs ${versus}${boardForApi.length ? ` on board ${boardForApi.join(" ")}` : " preflop"}`}
        >
          {hoverCell && hoverEq !== null && hoverEq !== undefined && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-accent/25 bg-surface px-3 py-2 shadow-card">
              <p className="font-sans text-fluid-lg font-semibold leading-none text-ink">
                {(hoverEq * 100).toFixed(1)}%
                <span className="ml-2 font-mono text-fluid-xs font-normal text-muted">{classLabel(hoverCell.i, hoverCell.j)}</span>
              </p>
              <p className="mt-1 font-mono text-[0.6rem] text-muted">
                #{ranks?.[hover!]} of 169 · vs {versus}{opponent === "range" && range[hover!] ? " · also in it" : ""}
              </p>
            </div>
          )}
          {hoverCell && hoverEq === null && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-surface px-3 py-2">
              <p className="font-mono text-fluid-xs text-muted">{classLabel(hoverCell.i, hoverCell.j)} · {opponent === "range" && data ? "no live combo, or the range is all blocked" : "no live combo on this board"}</p>
            </div>
          )}
          {error && (
            <p className="absolute right-3 top-3 font-mono text-[0.62rem] text-danger">{error}</p>
          )}
          {!ready && (
            <p className="absolute right-3 top-3 font-mono text-[0.62rem] text-warn">paint at least one hand into the range</p>
          )}
        </Terrain>
      </div>

      {/* ── controls ── */}
      <div className="space-y-6">
        <BoardPicker board={board} onChange={setBoard} variant="streets" />
        <div className={opponent === "range" ? "" : "opacity-60"}>
          <RangePainter
            title={opponent === "range" ? "villain's range" : "villain's range · unused vs random"}
            range={range}
            setRange={setRange}
            board={boardForApi}
            hover={hover}
            onHover={setHover}
            caption={opponent === "range"
              ? "click or drag to paint · the terrain re-prices against what you paint · exact on the river, sampled before it"
              : "click or drag to paint · switch the opponent to the painted range to use it"}
          />
        </div>
      </div>
    </div>
  );
}
