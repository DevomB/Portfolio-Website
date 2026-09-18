"use client";

import { useCallback, useMemo, useState } from "react";
import { m, AnimatePresence, LazyMotion, domMax } from "framer-motion";
import { dealRandomHoleCards, parseCodes } from "@/app/(poker)/poker";
import { findSampleWin, type SampleWin } from "@/app/(poker)/poker";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { code: "h", label: "♥", red: true },
  { code: "d", label: "♦", red: true },
  { code: "c", label: "♣", red: false },
  { code: "s", label: "♠", red: false },
];

type CardData = { rank: string; suitLabel: string; red: boolean; code: string };

function parseCards(line: string): CardData[] {
  return line.split(/[\s,]+/).map((code) => {
    code = code.trim();
    if (!code) return null;
    const rank = code.slice(0, -1);
    const suitCode = code.slice(-1);
    const suit = SUITS.find((s) => s.code === suitCode);
    if (!suit || !rank) return null;
    return { rank, suitLabel: suit.label, red: suit.red, code };
  }).filter((x): x is CardData => x !== null);
}

const ease = [0.21, 0.47, 0.32, 0.98] as [number, number, number, number];

// ── Single flat playing card ──────────────────────────────────────────────────
// Sized by its column (see .playing-card in globals.css), so a row of five
// fits a 320px phone and tops out at 64×90 on a desk.
function Card({
  card,
  highlight = false,
  dim = false,
}: {
  card: CardData;
  highlight?: boolean;
  dim?: boolean;
}) {
  return (
    <m.div
      layout
      className="playing-card"
      style={{
        color: card.red ? "var(--color-card-red)" : "var(--color-card-black)",
        border: highlight
          ? "2px solid var(--color-accent)"
          : "1.5px solid var(--color-card-edge)",
        boxShadow: highlight
          ? "0 4px 16px rgba(0,0,0,0.18), 0 0 0 3px rgb(var(--brand-purple-rgb) / 0.2)"
          : "0 3px 10px rgb(var(--brand-black-rgb) / 0.6)",
        opacity: dim ? 0.45 : 1,
      }}
    >
      <div className="playing-card-index">{card.rank}<span>{card.suitLabel}</span></div>
      <div className="playing-card-pip" aria-hidden>{card.suitLabel}</div>
      <div className="playing-card-index playing-card-index-flip" aria-hidden>{card.rank}<span>{card.suitLabel}</span></div>
    </m.div>
  );
}

// ── Empty card slot placeholder ───────────────────────────────────────────────
function EmptySlot() {
  return <div className="playing-card-slot" />;
}

/** Five columns, one per board card; the hand and villain rows use the same
 *  columns so every card on the table is the same size. */
const CARD_ROW = "grid max-w-[22rem] grid-cols-5 gap-1.5 sm:gap-2";

type EquityResult = {
  equity: number;
  iterations: number;
  durationMs: number;
  iterationsPerSec: number;
};

// ── Main component ────────────────────────────────────────────────────────────
export default function PokerLab() {
  const [heroLine, setHeroLine] = useState("Ah Kd");
  const [boardLine, setBoardLine] = useState("");
  const [iterations, setIterations] = useState(6000);
  const [seed, setSeed] = useState(2463534242);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [finalResult, setFinalResult] = useState<EquityResult | null>(null);
  const [sample, setSample] = useState<SampleWin | null>(null);
  const [cardTarget, setCardTarget] = useState<"hero" | "board">("hero");
  const [pendingRank, setPendingRank] = useState<string | null>(null);

  const heroCodes = useMemo(() => parseCodes(heroLine), [heroLine]);
  const boardCodes = useMemo(() => parseCodes(boardLine), [boardLine]);
  const heroCards = useMemo(() => parseCards(heroLine), [heroLine]);
  const boardCards = useMemo(() => parseCards(boardLine), [boardLine]);

  // Sample winning run cards (parsed)
  const sampleBoard = useMemo(
    () => sample ? sample.board5.map((c) => parseCards(c)[0]).filter((x): x is CardData => !!x) : null,
    [sample]
  );
  const sampleVillain = useMemo(
    () => sample ? sample.villain.map((c) => parseCards(c)[0]).filter((x): x is CardData => !!x) : null,
    [sample]
  );

  const appendCard = useCallback((rank: string, suit: string) => {
    const code = `${rank}${suit}`;
    if (cardTarget === "hero") {
      const next = [...heroCodes];
      setHeroLine(next.length >= 1 ? `${next[0]!} ${code}` : code);
      return;
    }
    const b = [...boardCodes];
    setBoardLine(b.length >= 5 ? [...b.slice(0, 4), code].join(" ") : [...b, code].join(" "));
  }, [boardCodes, cardTarget, heroCodes]);

  const randomizeHero = useCallback(() => {
    const nextSeed = Math.floor(Math.random() * 0xffffffff);
    const [a, b] = dealRandomHoleCards(nextSeed);
    setHeroLine(`${a} ${b}`);
    setSeed(nextSeed >>> 0);
  }, []);

  const run = async () => {
    setError("");
    setFinalResult(null);
    setSample(null);
    setRunning(true);
    try {
      const res = await fetch("/api/poker/equity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroLine, boardLine, iterations, seed: seed >>> 0 }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        const msg = data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error : "Simulation failed.";
        throw new Error(msg);
      }
      setFinalResult(data as EquityResult);
      // Find a sample winning hand client-side
      const s = findSampleWin(parseCodes(heroLine), parseCodes(boardLine), seed >>> 0);
      setSample(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed.");
    } finally {
      setRunning(false);
    }
  };

  const inputStyle = { borderColor: "var(--color-border)", background: "var(--color-surface-elevated)", fontSize: "16px" } as const;
  const inputCls = "w-full rounded-md border px-3 py-2 font-mono text-ink outline-none transition-colors focus:border-accent/50";

  // Which board cards to display: prefer sample (from winning run) when available
  const displayBoard: (CardData | null)[] = Array.from({ length: 5 }, (_, i) => {
    if (sampleBoard && i < sampleBoard.length) return sampleBoard[i] ?? null;
    return boardCards[i] ?? null;
  });

  return (
    // `layout` animations need domMax; nested here so that weight ships
    // only on routes that render the lab, never on `/` (see MotionProvider)
    <LazyMotion features={domMax}>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">

      {/* ── LEFT: Controls ─────────────────────────── */}
      <div className="min-w-0 space-y-5">

        {/* Target + picker */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            {(["hero", "board"] as const).map((t) => (
              <button key={t} type="button"
                onClick={() => { setCardTarget(t); setPendingRank(null); }}
                className="px-3 py-1.5 rounded-md border font-mono text-fluid-xs font-medium transition-colors"
                style={{
                  borderColor: cardTarget === t ? "var(--color-accent)" : "var(--color-border)",
                  background: cardTarget === t ? "var(--color-accent-bg)" : "transparent",
                  color: cardTarget === t ? "var(--color-accent-dim)" : "var(--color-muted)",
                }}>
                {t}
              </button>
            ))}
            {pendingRank && (
              <span className="font-mono text-fluid-xs text-accent ml-1">→ pick suit for {pendingRank}</span>
            )}
          </div>

          {/* thirteen ranks on one row, or A–8 over 7–2 on a phone — never a lone 2 */}
          <div className="mb-2 grid grid-cols-7 gap-1.5 sm:max-w-[34rem] sm:grid-cols-[repeat(13,minmax(0,1fr))]">
            {RANKS.map((r) => (
              <button key={r} type="button"
                onClick={() => setPendingRank((p) => (p === r ? null : r))}
                className="h-9 min-w-0 font-mono text-fluid-xs font-semibold rounded-md border transition-colors"
                style={{
                  borderColor: pendingRank === r ? "var(--color-accent)" : "var(--color-border)",
                  background: pendingRank === r ? "var(--color-accent-bg)" : "var(--color-surface-elevated)",
                  color: pendingRank === r ? "var(--color-accent)" : "var(--color-ink)",
                }}>
                {r}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {SUITS.map((s) => (
              <button key={s.code} type="button" disabled={!pendingRank}
                onClick={() => { if (!pendingRank) return; appendCard(pendingRank, s.code); setPendingRank(null); }}
                className="w-12 h-12 text-xl rounded-md border border-border bg-surface-elevated transition-colors hover:border-accent/40 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ color: s.red ? "var(--color-card-red)" : "var(--color-ink)" }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {([["AA", "Ah Ad"], ["AKs", "Ah Kh"], ["AKo", "Ah Kd"]] as [string, string][]).map(([label, val]) => (
            <button key={label} type="button" onClick={() => setHeroLine(val)}
              className="px-2.5 py-1 rounded-md border border-border font-mono text-fluid-xs text-muted hover:text-ink transition-colors"
              style={{ background: "var(--color-surface-elevated)" }}>
              {label}
            </button>
          ))}
          <button type="button" onClick={() => setBoardLine("")}
            className="px-2.5 py-1 rounded-md border border-border font-mono text-fluid-xs text-muted hover:text-ink transition-colors"
            style={{ background: "var(--color-surface-elevated)" }}>
            clear board
          </button>
          <button type="button" onClick={() => setHeroLine("")}
            className="px-2.5 py-1 rounded-md border border-border font-mono text-fluid-xs text-muted hover:text-ink transition-colors"
            style={{ background: "var(--color-surface-elevated)" }}>
            clear hero
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <label className="block">
            <span className="font-mono text-fluid-xs text-muted mb-1.5 block">hero hole cards</span>
            <input value={heroLine} onChange={(e) => setHeroLine(e.target.value)} className={inputCls} style={inputStyle} spellCheck={false} autoComplete="off" />
          </label>
          <label className="block">
            <span className="font-mono text-fluid-xs text-muted mb-1.5 block">board — optional (3, 4, or 5 cards)</span>
            <input value={boardLine} onChange={(e) => setBoardLine(e.target.value)} placeholder="Js Ts 2c" className={inputCls} style={inputStyle} spellCheck={false} autoComplete="off" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="font-mono text-fluid-xs text-muted mb-1.5 block">iterations</span>
              <input type="number" min={500} max={250000} step={500} value={iterations}
                onChange={(e) => { const v = Number.parseInt(e.target.value, 10); setIterations(Number.isFinite(v) ? Math.min(250000, Math.max(500, v)) : 6000); }}
                className={inputCls} style={inputStyle} />
            </label>
            <label className="block">
              <span className="font-mono text-fluid-xs text-muted mb-1.5 block">seed (uint32)</span>
              <input type="number" value={seed} onChange={(e) => setSeed(Number.parseInt(e.target.value, 10) >>> 0 || 0)} className={inputCls} style={inputStyle} />
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={randomizeHero} disabled={running}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-fluid-sm font-medium text-muted hover:text-ink transition-colors disabled:opacity-50"
            style={{ background: "var(--color-surface-elevated)" }}>
            Random hero
          </button>
          <button type="button" onClick={run} disabled={running}
            className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-fluid-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-surface-elevated)" }}
            onMouseEnter={(e) => { if (!running) e.currentTarget.style.background = "var(--color-accent-dim)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-accent)"; }}>
            {running ? "Running…" : "Run Monte Carlo"}
          </button>
        </div>

        {error && (
          <p className="rounded-md border px-3 py-2 font-mono text-fluid-xs" role="alert"
            style={{ borderColor: "rgb(200 40 58 / 0.4)", background: "rgb(200 40 58 / 0.1)", color: "var(--color-card-red)" }}>
            {error}
          </p>
        )}
      </div>

      {/* ── RIGHT: Results + table layout ─────────────────────────── */}
      <div className="min-w-0 rounded-xl border flex flex-col"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface-elevated)" }}>

        {/* Stats */}
        <div className="p-5 sm:p-6 border-b" style={{ borderColor: "var(--color-border)" }}>
          <p className="font-mono text-fluid-xs text-secondary tracking-wide mb-4">{"// results"}</p>
          <dl className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-fluid-sm text-muted">Hero equity</dt>
              <dd className="font-mono font-bold tabular-nums"
                style={{ fontSize: "var(--text-3xl)", color: finalResult ? "var(--color-accent)" : "var(--color-muted)", opacity: finalResult ? 1 : 0.3 }}>
                {finalResult ? `${finalResult.equity.toFixed(2)}%` : "—"}
              </dd>
            </div>
            <div className="w-full h-px" style={{ background: "var(--color-border)" }} />
            <div className="flex items-baseline justify-between">
              <dt className="font-mono text-fluid-xs text-muted">iterations</dt>
              <dd className="font-mono text-fluid-xs text-muted tabular-nums">{finalResult ? finalResult.iterations.toLocaleString() : "—"}</dd>
            </div>
            {finalResult && (
              <>
                <div className="flex items-baseline justify-between">
                  <dt className="font-mono text-fluid-xs text-muted">throughput</dt>
                  <dd className="font-mono text-fluid-xs tabular-nums" style={{ color: "var(--color-accent)" }}>
                    {finalResult.iterationsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })} iter/s
                  </dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="font-mono text-fluid-xs text-muted">wall time</dt>
                  <dd className="font-mono text-fluid-xs text-muted tabular-nums">{finalResult.durationMs.toFixed(1)} ms</dd>
                </div>
              </>
            )}
          </dl>

          {!finalResult && !running && (
            <p className="mt-5 font-mono whitespace-pre"
              style={{ fontSize: "0.6rem", color: "var(--color-muted)", opacity: 0.4, lineHeight: 1.7 }}>
              {`SELECT equity\nFROM simulations\nWHERE hero = '${heroLine || "?"}'\nLIMIT 1;`}
            </p>
          )}
          {running && (
            <div className="mt-5 flex items-center gap-2">
              <m.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-accent)" }} />
              <span className="font-mono text-fluid-xs text-accent">simulating…</span>
            </div>
          )}
        </div>

        {/* ── Poker table layout ─────────────────────────────────────── */}
        <div className="flex-1 p-5 sm:p-6 flex flex-col gap-6">

          {/* Board row — 5 community card slots */}
          <div>
            <p className="font-mono text-[0.6rem] text-muted/50 tracking-widest uppercase mb-3">
              {sampleBoard ? "sample winning board" : "board"}
            </p>
            <div className={CARD_ROW}>
              {displayBoard.map((card, i) => (
                <AnimatePresence key={i} mode="wait">
                  {card ? (
                    <m.div key={card.code}
                      initial={{ opacity: 0, y: -14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3, delay: i * 0.05, ease }}>
                      <Card card={card} />
                    </m.div>
                  ) : (
                    <EmptySlot key={`empty-${i}`} />
                  )}
                </AnimatePresence>
              ))}
            </div>
          </div>

          {/* Hero row */}
          <div>
            <p className="font-mono text-[0.6rem] tracking-widest uppercase mb-3"
              style={{ color: "var(--color-accent)", opacity: 0.7 }}>
              your hand
            </p>
            <div className={CARD_ROW}>
              <AnimatePresence mode="sync">
                {heroCards.slice(0, 2).map((card, i) => (
                  <m.div key={card.code}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.3, delay: i * 0.06, ease }}>
                    <Card
                      card={card}
                      highlight={sample ? sample.heroInBest[i] : false}
                    />
                  </m.div>
                ))}
                {heroCards.length === 0 && <EmptySlot />}
                {heroCards.length === 1 && <EmptySlot />}
              </AnimatePresence>
            </div>
          </div>

          {/* Villain row — only shown after simulation */}
          <AnimatePresence>
            {sampleVillain && (
              <m.div
                key="villain"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.4, delay: 0.15, ease }}>
                <p className="font-mono text-[0.6rem] text-muted/40 tracking-widest uppercase mb-3">
                  villain (sample run)
                </p>
                <div className={CARD_ROW}>
                  {sampleVillain.map((card, i) => (
                    <m.div key={card.code}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: 0.2 + i * 0.07, ease }}>
                      <Card card={card} dim />
                    </m.div>
                  ))}
                </div>
              </m.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          {sample && (
            <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.5 }}
              className="font-mono text-[0.58rem]" style={{ color: "var(--color-muted)", opacity: 0.45 }}>
              teal border = contributes to best hand · villain dimmed = losing
            </m.p>
          )}
        </div>
      </div>
    </div>
    </LazyMotion>
  );
}
