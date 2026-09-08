"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Terrain, { type TriFill } from "@/app/(poker)/Terrain";
import { clamp } from "@/lib/num";
import BoardPicker, { SUIT_GLYPH, SUIT_RED } from "@/app/(poker)/BoardPicker";
import RangePainter, { paintPreset } from "@/app/(poker)/RangePainter";
import { cellOf, classLabel } from "@/app/(poker)/handMatrix";
import type { ActionEvs, Flip, Policy, Robust } from "@/app/(poker)/riverModel";

/* Geometry of Decisions.
   Heads-up river, villain has bet. Height = EV of hero's best action for each
   of the 169 hand classes (mean over live combos), colour = that action. The
   opponent is painted, not solved: an arriving range plus three policy dials
   (see riverModel.ts). Everything is priced by /api/poker/river; the focus
   panel shows the arithmetic for one concrete combo and asks how wrong the
   read can be before the answer changes. */

type Action = "fold" | "call" | "raise";
type Cell = { label: string; evFold: number; evCall: number; evRaise: number; best: Action; margin: number; combos: number; split: Record<Action, number> } | null;
type Sizes = { pot: number; bet: number; raiseTo: number };
type Meta = { engine: string; liveCombos: number; villainCombos: number; ms: number };
type Surface = { board: string[]; sizes: Sizes; policy: Policy; cells: Cell[]; meta: Meta };
type FocusCombo = { cards: [string, string]; category: string; evs: ActionEvs; flips: Flip[]; robust: Robust };
type FocusResponse = { focus: { label: string; combos: FocusCombo[] }; sizes: Sizes; policy: Policy; meta: Meta };

const POT = 100;
const BETS = [{ label: "⅓ pot", bet: 33 }, { label: "½ pot", bet: 50 }, { label: "⅔ pot", bet: 66 }, { label: "pot", bet: 100 }, { label: "1½ pot", bet: 150 }];
const RAISES = [2.5, 3, 4];
const BANDS = [0.1, 0.15, 0.25];
const DEFAULT_BOARD = ["Kh", "Qd", "9h", "5h", "2c"];
const DIALS: { key: keyof Policy; label: string; hint: string }[] = [
  { key: "valueFrac", label: "value share", hint: "villain bets the strongest share of the arriving range for value" },
  { key: "bluffFreq", label: "bluff share", hint: "of what is left, villain bets the weakest share as a bluff" },
  { key: "foldToRaise", label: "value folds to a raise", hint: "bluffs always fold to a raise; value hands fold this often" },
];
const ACTIONS: Action[] = ["fold", "call", "raise"];
const ACTION_INK: Record<Action, string> = { fold: "var(--color-muted)", call: "var(--color-secondary-dim)", raise: "var(--color-accent-dim)" };
const ACTION_SWATCH: Record<Action, string> = { fold: "oklch(30% 0.02 300)", call: "oklch(58% 0.17 145)", raise: "oklch(60% 0.22 300)" };
const CATEGORY_LABEL: Record<string, string> = {
  highCard: "high card", onePair: "one pair", twoPair: "two pair", threeOfAKind: "trips", straight: "straight",
  flush: "flush", fullHouse: "full house", fourOfAKind: "quads", straightFlush: "straight flush", royalFlush: "royal flush",
};

const chips = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}`;
const f3 = (v: number) => v.toFixed(3);
const indexOfLabel = (label: string) => {
  for (let k = 0; k < 169; k++) { const { i, j } = cellOf(k); if (classLabel(i, j) === label) return k; }
  return 0;
};

function Card({ code }: { code: string }) {
  return (
    <span className="font-mono font-bold" style={{ color: SUIT_RED.has(code[1]!) ? "var(--color-danger)" : "var(--color-ink)" }}>
      {code[0] === "T" ? "10" : code[0]}{SUIT_GLYPH[code[1]!]}
    </span>
  );
}

export default function RiverDecisions() {
  const [board, setBoard] = useState<string[]>(DEFAULT_BOARD);
  const [range, setRange] = useState<boolean[]>(() => paintPreset("top25"));
  const [policy, setPolicy] = useState<Policy>({ valueFrac: 0.35, bluffFreq: 0.35, foldToRaise: 0.2 });
  const [bet, setBet] = useState(66);
  const [raiseMult, setRaiseMult] = useState(3);
  const [band, setBand] = useState(0.15);
  const [focus, setFocus] = useState<number | null>(() => indexOfLabel("AKo"));
  const [comboIx, setComboIx] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [surface, setSurface] = useState<{ key: string; data: Surface } | null>(null);
  const [focusResult, setFocusResult] = useState<{ key: string; data: FocusResponse } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const raiseTo = Math.round(bet * raiseMult);
  const rangeW = useMemo(() => range.map((b) => (b ? 1 : 0)), [range]);
  const ready = board.length === 5 && rangeW.some((w) => w > 0);
  const request = useMemo(() => ({ board, range: rangeW, pot: POT, bet, raiseTo, policy }), [board, rangeW, bet, raiseTo, policy]);
  const requestKey = useMemo(() => JSON.stringify(request), [request]);
  const focusKey = `${requestKey}|${focus}|${band}`;

  const post = useCallback(
    (body: unknown, signal: AbortSignal) =>
      fetch("/api/poker/river", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal })
        .then(async (r) => {
          const data = await r.json();
          if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
          return data as unknown;
        }),
    [],
  );

  // the surface — debounced so a slider drag prices once it settles
  useEffect(() => {
    if (!ready) return;
    const ac = new AbortController();
    const key = requestKey;
    const t = setTimeout(() => {
      post(request, ac.signal)
        .then((data) => { setError(null); setSurface({ key, data: data as Surface }); })
        .catch((e: unknown) => { if ((e as Error).name !== "AbortError") setError((e as Error).message); });
    }, 120);
    return () => { clearTimeout(t); ac.abort(); };
  }, [request, requestKey, ready, post]);

  // the focus hand — same read, one class, with the sensitivity analysis
  useEffect(() => {
    if (!ready || focus === null) return;
    const ac = new AbortController();
    const key = focusKey;
    const t = setTimeout(() => {
      post({ ...request, focus, band, surface: false }, ac.signal)
        .then((data) => setFocusResult({ key, data: data as FocusResponse }))
        .catch((e: unknown) => { if ((e as Error).name !== "AbortError") setError((e as Error).message); });
    }, 120);
    return () => { clearTimeout(t); ac.abort(); };
  }, [request, focusKey, focus, band, ready, post]);

  const pending = !surface || surface.key !== requestKey;
  const cells = surface?.data.cells;

  // height = EV of the best action, over the largest payoff in the game (P + R)
  const target = useMemo(() => {
    const t = new Float32Array(169);
    if (!surface) return t;
    const scale = surface.data.sizes.pot + surface.data.sizes.raiseTo;
    surface.data.cells.forEach((c, k) => { t[k] = c ? clamp(Math.max(c.evFold, c.evCall, c.evRaise) / scale, 0, 1) : 0; });
    return t;
  }, [surface]);

  const triFill = useCallback<TriFill>(
    (p, q, r, mean, shade) => {
      const c = cells?.[p];
      if (!c || !cells?.[q] || !cells?.[r]) return "rgb(var(--brand-purple-rgb) / 0.08)";
      if (c.best === "fold") return `oklch(${(20 + 14 * shade).toFixed(1)}% 0.02 300)`;
      const L = (clamp((0.3 + 0.45 * mean) * (0.75 + 0.35 * shade), 0, 1) * 100).toFixed(1);
      return c.best === "call"
        ? `oklch(${L}% ${(0.13 + 0.09 * mean).toFixed(3)} 145)`
        : `oklch(${L}% ${(0.16 + 0.1 * mean).toFixed(3)} 300)`;
    },
    [cells],
  );

  const select = (k: number) => { setFocus(k); setComboIx(0); };
  const hoverCell = hover !== null ? cells?.[hover] : undefined;
  const fr = focusResult?.data;
  const focusStale = focusResult?.key !== focusKey;
  const combos = fr?.focus.combos ?? [];
  const combo = combos.length ? combos[Math.min(comboIx, combos.length - 1)]! : null;

  let checkLines = "";
  if (fr && combo) {
    const { pot: P, bet: B, raiseTo: R } = fr.sizes;
    const e = combo.evs;
    checkLines = [
      "call  = pWin·(P+B) + pTie·P/2 − pLose·B",
      `      = ${f3(e.pWin)}·${P + B} + ${f3(e.pTie)}·${P / 2} − ${f3(1 - e.pWin - e.pTie)}·${B} = ${chips(e.evCall)}`,
      "raise = pFold·(P+B) + (1−pFold)·[pWin′·(P+R) + pTie′·P/2 − pLose′·R]",
      `      = ${f3(e.pFoldToRaise)}·${P + B} + ${f3(1 - e.pFoldToRaise)}·[${f3(e.pWinIfCalled)}·${P + R} + ${f3(e.pTieIfCalled)}·${P / 2} − ${f3(1 - e.pWinIfCalled - e.pTieIfCalled)}·${R}] = ${chips(e.evRaise)}`,
    ].join("\n");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-6">
        {/* ── terrain ── */}
        <div className="card-soft p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-2">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-fluid-xs text-muted">
              <span>height = EV of your best action</span>
              {ACTIONS.map((a) => (
                <span key={a} className="inline-flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACTION_SWATCH[a] }} />
                  {a}
                </span>
              ))}
              <span>· click a hand · drag to rotate</span>
            </p>
            <p className="font-mono text-[0.6rem] text-muted/70">
              {surface
                ? `C++ engine · ${surface.data.meta.liveCombos} live combos · villain arrives with ${surface.data.meta.villainCombos} · ${surface.data.meta.ms} ms`
                : "pricing…"}
            </p>
          </div>

          <Terrain
            target={target}
            triFill={triFill}
            hover={hover}
            onHover={setHover}
            onSelect={select}
            selected={focus}
            pending={pending}
            ariaLabel={`River decision surface over 169 hands on board ${board.join(" ")}`}
          >
            {hover !== null && cells && (hoverCell ? (
              <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-accent/25 bg-surface px-3 py-2 shadow-card">
                <p className="font-sans text-fluid-lg font-semibold leading-none" style={{ color: ACTION_INK[hoverCell.best] }}>
                  {hoverCell.best}
                  <span className="ml-2 font-mono text-fluid-xs font-normal text-muted">{hoverCell.label}</span>
                </p>
                <p className="mt-1 font-mono text-[0.6rem] text-muted">
                  fold {chips(hoverCell.evFold)} · call {chips(hoverCell.evCall)} · raise {chips(hoverCell.evRaise)} · {hoverCell.split[hoverCell.best]}/{hoverCell.combos} combos agree
                </p>
              </div>
            ) : (
              <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-surface px-3 py-2">
                <p className="font-mono text-fluid-xs text-muted">{classLabel(cellOf(hover).i, cellOf(hover).j)} · no live combo on this board</p>
              </div>
            ))}
            {error && <p className="absolute right-3 top-3 font-mono text-[0.62rem] text-danger">{error}</p>}
          </Terrain>
        </div>

        {/* ── focus: one hand, every number, and how wrong the read can be ── */}
        <div className="card-soft p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-fluid-xs text-muted">you hold</p>
            <select
              value={focus ?? ""}
              onChange={(e) => select(Number(e.target.value))}
              aria-label="hand class to inspect"
              className="chip-soft bg-surface px-2 py-1 font-mono text-[0.62rem] text-ink"
            >
              {Array.from({ length: 169 }, (_, k) => { const { i, j } = cellOf(k); return <option key={k} value={k}>{classLabel(i, j)}</option>; })}
            </select>
          </div>

          {!fr || !combo ? (
            <p className="mt-3 font-mono text-fluid-xs text-muted">{focus === null ? "click a hand on the terrain" : fr && !combos.length ? "no live combo on this board" : "pricing…"}</p>
          ) : (
            <div className={`mt-3 space-y-5 transition-opacity ${focusStale ? "opacity-70" : ""}`}>
              {/* the concrete combos of this class */}
              <div className="flex flex-wrap gap-1.5">
                {combos.map((c, ix) => (
                  <button
                    key={c.cards.join("")}
                    type="button"
                    onClick={() => setComboIx(ix)}
                    className={`chip-soft px-2 py-1 text-[0.72rem] transition-colors ${ix === Math.min(comboIx, combos.length - 1) ? "border-accent/60" : "hover:border-accent/40"}`}
                  >
                    <Card code={c.cards[0]} /> <Card code={c.cards[1]} />
                    <span className="ml-1.5 font-mono text-[0.58rem]" style={{ color: ACTION_INK[c.evs.best] }}>{c.evs.best}</span>
                  </button>
                ))}
              </div>

              {/* the three actions */}
              <div>
                <div className="grid grid-cols-3 gap-2">
                  {ACTIONS.map((a) => {
                    const v = a === "fold" ? combo.evs.evFold : a === "call" ? combo.evs.evCall : combo.evs.evRaise;
                    const best = combo.evs.best === a;
                    return (
                      <div key={a} className={`rounded-md border px-3 py-2 ${best ? "border-accent/50 bg-accent/10" : "border-border"}`}>
                        <p className="font-mono text-[0.6rem]" style={{ color: ACTION_INK[a] }}>{a}{a === "raise" ? ` to ${fr.sizes.raiseTo}` : a === "call" ? ` ${fr.sizes.bet}` : ""}</p>
                        <p className="font-sans text-fluid-lg font-semibold leading-tight text-ink">{chips(v)}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 font-mono text-[0.6rem] text-muted">
                  chips · pot {fr.sizes.pot} · you have {CATEGORY_LABEL[combo.category] ?? combo.category} · villain bets {combo.evs.bettingWeight.toFixed(0)} combos into you
                  {" · "}ahead of {Math.round(combo.evs.pWin * 100)}% of them
                </p>
              </div>

              {/* check it */}
              <div>
                <p className="mb-1 font-mono text-fluid-xs text-muted">check it</p>
                <pre className="overflow-x-auto rounded-md bg-surface px-3 py-2 font-mono text-[0.62rem] leading-relaxed text-ink">{checkLines}</pre>
                <p className="mt-1 font-mono text-[0.58rem] text-muted/70">
                  P pot, B bet, R raise-to · pWin′ is the chance you are ahead given villain calls the raise · probabilities rounded to three places
                </p>
              </div>

              {/* how wrong can my read be */}
              <div>
                <p className="mb-2 font-mono text-fluid-xs text-muted">how wrong can my read be?</p>
                <div className="space-y-2.5">
                  {DIALS.map((d) => {
                    const flip = combo.flips.find((f) => f.param === d.key);
                    const cur = fr.policy[d.key];
                    return (
                      <div key={d.key}>
                        <div className="flex justify-between gap-3 font-mono text-[0.62rem]">
                          <span className="text-ink">{d.label}</span>
                          <span className="text-right text-muted">
                            {flip ? (
                              <>
                                {flip.from.toFixed(2)} → {flip.to.toFixed(2)} and{" "}
                                <span style={{ color: ACTION_INK[combo.evs.best] }}>{combo.evs.best}</span> becomes{" "}
                                <span style={{ color: ACTION_INK[flip.newBest] }}>{flip.newBest}</span>
                              </>
                            ) : (
                              "no value from 0 to 1 changes the answer"
                            )}
                          </span>
                        </div>
                        <div className="relative mt-1.5 h-1.5 rounded-full bg-surface">
                          {flip && (
                            <span
                              className="absolute top-0 h-full rounded-full"
                              style={{ left: `${Math.min(cur, flip.to) * 100}%`, width: `${Math.abs(flip.to - cur) * 100}%`, background: "rgb(var(--color-warn-rgb) / 0.5)" }}
                            />
                          )}
                          <span className="absolute -top-0.5 h-2.5 w-0.5 bg-ink" style={{ left: `${cur * 100}%` }} />
                          {flip && <span className="absolute -top-0.5 h-2.5 w-0.5" style={{ left: `${flip.to * 100}%`, background: ACTION_INK[flip.newBest] }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* exploitative vs robust */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-fluid-xs text-muted">exploitative vs robust</p>
                  <span className="inline-flex gap-1">
                    {BANDS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBand(b)}
                        className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] transition-colors ${band === b ? "bg-accent-bg text-accent-dim" : "text-muted hover:text-ink"}`}
                      >
                        ±{Math.round(b * 100)}%
                      </button>
                    ))}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-border px-3 py-2">
                    <p className="font-mono text-[0.6rem] text-muted">best at your read</p>
                    <p className="font-sans text-fluid-lg font-semibold leading-tight" style={{ color: ACTION_INK[combo.robust.exploitative] }}>{combo.robust.exploitative}</p>
                  </div>
                  <div className="rounded-md border border-border px-3 py-2">
                    <p className="font-mono text-[0.6rem] text-muted">best worst case, every dial ±{Math.round(combo.robust.band * 100)}%</p>
                    <p className="font-sans text-fluid-lg font-semibold leading-tight" style={{ color: ACTION_INK[combo.robust.robust] }}>{combo.robust.robust}</p>
                  </div>
                </div>
                <p className="mt-2 font-mono text-[0.6rem] text-muted">
                  worst cases · fold {chips(0)} · call {chips(combo.robust.worstCase.call)} · raise {chips(combo.robust.worstCase.raise)}
                  {combo.robust.exploitative === combo.robust.robust ? " · the read and the hedge agree" : " · the exploit only pays if the read is right"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── controls ── */}
      <div className="space-y-6">
        <BoardPicker board={board} onChange={setBoard} variant="river" />

        <div className="card-soft p-4">
          <p className="font-mono text-fluid-xs text-muted">villain bets</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BETS.map((b) => (
              <button
                key={b.bet}
                type="button"
                onClick={() => setBet(b.bet)}
                className={`chip-soft px-2 py-0.5 font-mono text-[0.6rem] transition-colors ${bet === b.bet ? "border-accent/60 text-ink" : "text-muted hover:text-ink"}`}
              >
                {b.label}
              </button>
            ))}
          </div>
          <p className="mt-3 font-mono text-fluid-xs text-muted">your raise</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RAISES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setRaiseMult(m)}
                className={`chip-soft px-2 py-0.5 font-mono text-[0.6rem] transition-colors ${raiseMult === m ? "border-accent/60 text-ink" : "text-muted hover:text-ink"}`}
              >
                {m}× bet · to {Math.round(bet * m)}
              </button>
            ))}
          </div>
          <p className="mt-4 font-mono text-fluid-xs text-muted">what villain does</p>
          <div className="mt-2 space-y-3">
            {DIALS.map((d) => (
              <label key={d.key} className="block">
                <span className="flex justify-between font-mono text-[0.62rem]">
                  <span className="text-ink">{d.label}</span>
                  <span className="text-muted">{policy[d.key].toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={policy[d.key]}
                  onChange={(e) => { const v = Number(e.target.value); setPolicy((p) => ({ ...p, [d.key]: v })); }}
                  aria-label={d.label}
                  className="mt-1 w-full"
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span className="block font-mono text-[0.56rem] text-muted/70">{d.hint}</span>
              </label>
            ))}
          </div>
        </div>

        <RangePainter
          title="villain arrives with"
          range={range}
          setRange={setRange}
          board={board}
          hover={hover}
          onHover={setHover}
          caption="click or drag to paint · the hands villain can have when the river bet goes in"
        />
      </div>
    </div>
  );
}
