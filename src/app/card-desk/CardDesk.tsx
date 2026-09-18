"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { m, AnimatePresence } from "framer-motion";
import { Button } from "@/app/(chrome)/Button";

/* ── The Card Sum Options Desk ────────────────────────────────────────────────
   IMC's mock trading game: options on the sum of n cards drawn from a deck.
   Every number here comes from the published `cardquant` Python package
   running on CPython behind /api/carddesk — nothing is priced in the browser.
   The desk's job is to make "see a card, watch everything re-price" tactile. */

type Greeks = { theo: number | null; delta: number | null; gamma: number | null; theta: number | null; charm: number | null; color: number | null };
type StrikeRow = { strike: number; cte: number; call: Greeks; put: Greeks };
type Quote = {
  n: number;
  seen: number[];
  sumSeen: number;
  cte: number;
  future: number | null;
  replacement: boolean;
  strikes: StrikeRow[];
  meta: { library: string; runtime: string; ms: number };
};

const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const;
const rankLabel = (r: number) => (r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r));
const DEFAULT_STRIKES = [50, 60, 70, 80, 90];
const MAX_STRIKES = 10;

const ease = [0.21, 0.47, 0.32, 0.98] as [number, number, number, number];

const fmt = (v: number | null, d = 4) => (v === null || Number.isNaN(v) ? "—" : v.toFixed(d));

export default function CardDesk() {
  const [n, setN] = useState(10);
  const [strikes, setStrikes] = useState<number[]>(DEFAULT_STRIKES);
  const [replacement, setReplacement] = useState(false);
  const [seen, setSeen] = useState<number[]>([]);
  const [strikeInput, setStrikeInput] = useState("");

  // The request key IS the pricing state: a quote is "pending" whenever the
  // one we hold was priced for a different key. No synchronous setState in the
  // effect — every state write happens when the network answers.
  const key = useMemo(
    () => `${n}|${seen.join(",")}|${strikes.join(",")}|${replacement ? 1 : 0}`,
    [n, seen, strikes, replacement],
  );
  const [result, setResult] = useState<{ key: string; quote: Quote; wire: { ms: number; cached: boolean } } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boardScroll = useRef<HTMLDivElement>(null);
  const [moreRight, setMoreRight] = useState(false);

  const quote = result?.quote ?? null;
  const wire = result?.wire ?? null;
  const error = failure?.key === key ? failure.message : null;
  const pending = !error && result?.key !== key;

  // remaining copies of each rank in the shoe
  const remaining = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of RANKS) map.set(r, replacement ? Infinity : 4 - seen.filter((c) => c === r).length);
    return map;
  }, [seen, replacement]);

  const expired = seen.length >= n;

  // Re-price on every change. The URL is the cache key: same cards, same price.
  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const t0 = performance.now();
    const params = new URLSearchParams({
      n: String(n),
      seen: seen.join(","),
      strikes: strikes.join(","),
      replacement: replacement ? "1" : "0",
    });
    fetch(`/api/carddesk?${params}`, { signal: ac.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setResult({
          key,
          quote: body as Quote,
          wire: {
            ms: Math.round(performance.now() - t0),
            cached: /HIT/i.test(res.headers.get("x-vercel-cache") ?? ""),
          },
        });
      })
      .catch((err: unknown) => {
        if ((err as { name?: string }).name === "AbortError") return;
        setFailure({ key, message: err instanceof Error ? err.message : "pricing failed" });
      });
    return () => ac.abort();
  }, [key, n, seen, strikes, replacement]);

  // is there more of the board to the right of what is showing?
  useEffect(() => {
    const el = boardScroll.current;
    if (!el) return;
    const check = () => setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", check, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", check); };
  }, []);

  const draw = (r: number) => {
    if (expired || (remaining.get(r) ?? 0) <= 0) return;
    setSeen((s) => [...s, r]);
  };
  const drawRandom = () => {
    if (expired) return;
    const pool = RANKS.flatMap((r) => Array<number>(replacement ? 4 : Math.max(0, remaining.get(r) ?? 0)).fill(r));
    if (pool.length === 0) return;
    setSeen((s) => [...s, pool[Math.floor(Math.random() * pool.length)]!]);
  };
  const undo = () => setSeen((s) => s.slice(0, -1));
  const reset = () => setSeen([]);

  const changeN = (next: number) => {
    setN(next);
    setSeen((s) => (s.length > next ? s.slice(0, next) : s));
  };

  const addStrike = () => {
    const k = Number.parseInt(strikeInput, 10);
    if (!Number.isFinite(k) || k < 0 || k > 200) return;
    setStrikes((ks) => (ks.includes(k) || ks.length >= MAX_STRIKES ? ks : [...ks, k].sort((a, b) => a - b)));
    setStrikeInput("");
  };
  const removeStrike = (k: number) => setStrikes((ks) => (ks.length > 1 ? ks.filter((x) => x !== k) : ks));

  const future = quote?.future ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ── left: the shoe, the drawn cards, the board ─────────────────── */}
      <div className="min-w-0 space-y-6">
        {/* headline numbers */}
        <div className="card-soft p-5 grid gap-4 sm:grid-cols-3">
          <Stat label="future (expected sum)" value={future === null ? "—" : future.toFixed(2)} accent />
          <Stat label="sum seen" value={String(quote?.sumSeen ?? seen.reduce((a, b) => a + b, 0))} />
          <Stat label="cards to expiry" value={String(quote?.cte ?? Math.max(0, n - seen.length))} />
        </div>

        {/* the shoe */}
        <div className="card-soft p-5">
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-mono text-fluid-xs text-secondary tracking-wide">{"// draw a card"}</p>
            <p className="font-mono text-fluid-xs text-muted">{expired ? "expired — all cards drawn" : `${n - seen.length} more to draw`}</p>
          </div>
          {/* all thirteen ranks on one row, or A–7 over 8–K where a row of
              thirteen would crush the labels — never a lone K */}
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(13,minmax(0,1fr))] sm:gap-2">
            {RANKS.map((r) => {
              const left = remaining.get(r) ?? 0;
              const out = expired || left <= 0;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => draw(r)}
                  disabled={out}
                  className="group relative flex min-w-0 flex-col items-center justify-center rounded-lg border px-1 py-2.5 font-mono transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:border-accent/50 hover:bg-accent-bg"
                  style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
                  aria-label={`draw ${rankLabel(r)}`}
                >
                  <span className="text-fluid-base font-semibold text-ink">{rankLabel(r)}</span>
                  <span className="text-fluid-xs text-muted">{replacement ? "∞" : `×${left}`}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={drawRandom} disabled={expired}>draw random</Button>
            <button type="button" onClick={undo} disabled={seen.length === 0} className="chip-soft px-3.5 py-1.5 font-mono text-fluid-xs transition-colors hover:text-accent-dim disabled:opacity-40">
              undo
            </button>
            <button type="button" onClick={reset} disabled={seen.length === 0} className="chip-soft px-3.5 py-1.5 font-mono text-fluid-xs transition-colors hover:text-accent-dim disabled:opacity-40">
              reset
            </button>
          </div>
        </div>

        {/* drawn cards */}
        <div className="card-soft p-5 min-h-[7.5rem]">
          <p className="font-mono text-fluid-xs text-secondary tracking-wide mb-3">{"// seen"}</p>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {seen.map((r, i) => (
                <m.div
                  key={`${i}-${r}`}
                  initial={{ opacity: 0, y: 8, rotate: -4 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.28, ease }}
                  className="relative flex h-16 w-11 items-center justify-center rounded-md font-mono text-fluid-base font-bold select-none"
                  style={{
                    background: "linear-gradient(160deg, var(--color-card-face) 0%, var(--color-card-face-2) 100%)",
                    border: "1.5px solid var(--color-card-edge)",
                    color: "var(--color-card-black)",
                    boxShadow: "0 3px 10px rgb(var(--brand-black-rgb) / 0.6)",
                  }}
                >
                  {rankLabel(r)}
                  <span className="absolute bottom-0.5 right-1 text-fluid-xs font-normal">{r}</span>
                </m.div>
              ))}
            </AnimatePresence>
            {seen.length === 0 && <p className="text-fluid-sm text-muted self-center">No cards yet — the whole distribution is still open.</p>}
          </div>
        </div>

        {/* the board */}
        <div className="card-soft overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-3" style={{ borderColor: "var(--color-border)" }}>
            <p className="shrink-0 whitespace-nowrap font-mono text-fluid-xs text-secondary tracking-wide">{"// board"}</p>
            <p className="font-mono text-fluid-xs text-muted">
              {error ? <span className="text-danger">{error}</span> : pending ? "pricing…" : quote ? (
                <>
                  {quote.meta.library} · {quote.meta.runtime} · {quote.meta.ms.toFixed(0)} ms compute
                  {wire ? ` · ${wire.ms} ms wire${wire.cached ? " · edge cache" : ""}` : ""}
                </>
              ) : null}
            </p>
          </div>
          {/* on a phone the Greeks scroll sideways under a pinned strike
              column, and a fade on the right edge says there is more */}
          <div className="relative">
          <div ref={boardScroll} className="overflow-x-auto">
            <table className="w-full font-mono text-fluid-xs tabular-nums" style={{ opacity: pending ? 0.55 : 1, transition: "opacity 160ms" }}>
              <thead>
                <tr className="text-muted" style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="sticky left-0 z-[1] bg-surface-elevated px-4 py-2.5 text-left font-normal">K</th>
                  <th className="px-2 py-2.5 text-left font-normal text-secondary" colSpan={6}>call · theo Δ Γ Θ ψ χ</th>
                  <th className="px-2 py-2.5 text-left font-normal text-accent-dim" colSpan={6}>put · theo Δ Γ Θ ψ χ</th>
                </tr>
              </thead>
              <tbody>
                {(quote?.strikes ?? strikes.map((k) => ({ strike: k, cte: 0, call: EMPTY, put: EMPTY }))).map((row) => {
                  const callItm = future !== null && future > row.strike;
                  return (
                    <tr key={row.strike} style={{ borderBottom: "1px solid rgb(var(--brand-purple-rgb) / 0.12)" }}>
                      <td className="sticky left-0 z-[1] bg-surface-elevated px-4 py-2.5 font-semibold text-ink">{row.strike}</td>
                      <GreekCells g={row.call} itm={callItm} tone="secondary" />
                      <GreekCells g={row.put} itm={future !== null && future < row.strike} tone="accent" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {moreRight && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-elevated" />}
          </div>
        </div>
      </div>

      {/* ── right: the game's parameters ────────────────────────────────── */}
      <div className="min-w-0 space-y-6">
        <div className="card-soft p-5">
          <p className="font-mono text-fluid-xs text-secondary tracking-wide mb-4">{"// game"}</p>

          <label className="block mb-4">
            <span className="font-mono text-fluid-xs text-muted">cards drawn (n)</span>
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={3} max={12} value={n} onChange={(e) => changeN(Number(e.target.value))} className="w-full accent-[#7c00ff]" />
              <span className="font-mono text-fluid-sm text-ink w-6 text-right">{n}</span>
            </div>
          </label>

          <div className="mb-4">
            <span className="font-mono text-fluid-xs text-muted">strikes</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {strikes.map((k) => (
                <button key={k} type="button" onClick={() => removeStrike(k)} className="chip-accent px-2.5 py-1 font-mono text-fluid-xs transition-opacity hover:opacity-70" title="remove" aria-label={`remove strike ${k}`}>
                  {k} <span aria-hidden>×</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={strikeInput}
                onChange={(e) => setStrikeInput(e.target.value.replace(/[^0-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && addStrike()}
                placeholder={strikes.length >= MAX_STRIKES ? "max 10" : "add strike"}
                disabled={strikes.length >= MAX_STRIKES}
                className="w-full rounded-md border bg-transparent px-3 py-1.5 font-mono text-fluid-xs text-ink outline-none focus:border-accent/60 disabled:opacity-40"
                style={{ borderColor: "var(--color-border)" }}
              />
              <button type="button" onClick={addStrike} className="chip-soft px-3 py-1.5 font-mono text-fluid-xs hover:text-accent-dim">add</button>
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="font-mono text-fluid-xs text-muted">draw with replacement</span>
            <input type="checkbox" checked={replacement} onChange={(e) => { setReplacement(e.target.checked); setSeen([]); }} className="h-4 w-4 accent-[#09ff00]" />
          </label>
        </div>

        <div className="card-soft p-5 text-fluid-sm leading-relaxed text-muted space-y-3">
          <p><span className="text-ink font-semibold">The game.</span> Draw <span className="font-mono text-ink">{n}</span> cards (A = 1 … K = 13). Calls and puts settle on the final sum against each strike.</p>
          <p><span className="text-ink font-semibold">Δ</span> is the probability of finishing in the money. <span className="text-ink font-semibold">Γ</span> is how fast Δ moves across one strike.</p>
          <p><span className="text-ink font-semibold">Θ ψ χ</span> are the time Greeks — and here time is <em>the next card</em>: how theo, Δ and Γ change when the expected card is drawn.</p>
          <p className="text-fluid-xs">Priced exactly by enumeration in the published <a href="https://pypi.org/project/cardquant/" target="_blank" rel="noopener noreferrer" className="text-accent-dim transition-colors hover:text-ink">cardquant</a> package — real CPython, nothing ported.</p>
        </div>
      </div>
    </div>
  );
}

const EMPTY: Greeks = { theo: null, delta: null, gamma: null, theta: null, charm: null, color: null };

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="font-mono text-fluid-xs tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-fluid-3xl font-bold tabular-nums" style={{ color: accent ? "var(--color-secondary)" : "var(--color-ink)" }}>{value}</p>
    </div>
  );
}

function GreekCells({ g, itm, tone }: { g: Greeks; itm: boolean; tone: "secondary" | "accent" }) {
  const strong = tone === "secondary" ? "var(--color-secondary)" : "var(--color-accent-dim)";
  return (
    <>
      <td className="px-2 py-2.5 font-semibold" style={{ color: itm ? strong : "var(--color-ink)" }}>{fmt(g.theo, 2)}</td>
      <td className="px-2 py-2.5 text-muted">{fmt(g.delta)}</td>
      <td className="px-2 py-2.5 text-muted">{fmt(g.gamma)}</td>
      <td className="px-2 py-2.5 text-muted">{fmt(g.theta)}</td>
      <td className="px-2 py-2.5 text-muted">{fmt(g.charm)}</td>
      <td className="px-2 py-2.5 text-muted">{fmt(g.color)}</td>
    </>
  );
}
