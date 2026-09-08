"use client";

import { m, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fullDeck, mulberry32, shuffleInPlace, type Card } from "@/app/(poker)/poker";
import { CardBack, CardFace } from "@/app/(home)/SplashCards";
import { classifyFive } from "@/app/(poker)/poker";
import SplashConfetti from "@/app/(home)/SplashConfetti";

// ── Geometry ──────────────────────────────────────────────────────────────────
// A fixed pixel design scaled as one composition to fit any viewport, so the fan
// and the name inside it always hold the same proportions.
const BOX = 680;      // design canvas (square) — sized to clear the pulled-out cards
const COUNT = 52;     // the WHOLE deck rides the ring — every card is on screen
const CARD_W = 52;
const CARD_H = 74;
const RING_R = 250;   // canvas centre → card centre; sized so 52 cards at ~30px
                      // pitch overlap like a properly spread deck, corner indices clear
const LIFT = 26;      // extra radius for a card pulled out of the fan
const REVEAL_COUNT = 5;

const STEP_DEG = 360 / COUNT;  // angular gap between neighbours in the closed ring

// The deck starts squared up in the centre, rises as one stack to 12 o'clock,
// and then unfurls clockwise: every card sweeps the same way round the
// circumference to its seat, the last one tracing almost the whole circle.
const seatAngle = (i: number) => i * STEP_DEG;

// A card being shown cancels its arm's rotation so the face reads upright. Taking
// that the short way round keeps a card seated at 350° from spinning most of a
// turn just to straighten up.
const uprightRotate = (angle: number) => (((-angle % 360) + 540) % 360) - 180;

// A squared-up stack has a little slop in it. This tilt lives on the card itself,
// NOT on the arm: an arm tilt is invisible at the centre but becomes a lateral
// offset once the card is at radius — it was smearing the stack apart during the
// rise. A local tilt keeps every card in the same spot at any radius.
const stackSlop = (i: number) => (i % 2 ? 1 : -1) * (0.7 + (i % 5) * 0.5);


const ease = [0.21, 0.47, 0.32, 0.98] as [number, number, number, number];
const easeOut = [0.16, 0.84, 0.34, 1] as [number, number, number, number];
// the sweep MUST be linear: any curve would desynchronise the in-flight cards
// (same curve, different durations → different angles) and the moving deck
// would smear apart instead of travelling as one stack
const linear = [0, 0, 1, 1] as [number, number, number, number];
// the rise: slow launch, fast middle, soft landing — deliberate, mechanical
const glide = [0.55, 0, 0.15, 1] as [number, number, number, number];
// real overshoot for the pull-out only — true peak ≈ 1.09, i.e. ~2.3px of
// visible spring on the 26px travel. Never used on the arm sweep, where
// overshoot scales with distance and swung the far cards ~25° past their seats.
const settle = [0.3, 1.56, 0.62, 1] as [number, number, number, number];

// ── Choreography (seconds) ────────────────────────────────────────────────────
// Every value below is baked into a per-card `delay` at mount. Nothing here is
// driven by React state, so the whole sequence runs without a single re-render
// mid-flight. Phases are strictly sequential: the stack finishes rising before
// the fan peels, the ring closes before the reveals pull out.
const APPEAR = 0.1;        // stack fades in as one object
const APPEAR_DUR = 0.35;

const LIFT_START = 0.42;   // stack rides to 12 o'clock
const LIFT_STEP = 0.0005;  // ~18ms of total trail: parallax enough to read as
                           // cards, tight enough to stay one object at glide's
                           // peak velocity (~26px elongation, half a card)
const LIFT_DUR = 0.5;
const LIFT_END = LIFT_START + (COUNT - 1) * LIFT_STEP + LIFT_DUR; // ≈ 0.94

const FAN_START = LIFT_END + 0.08; // the settle beat, derived so the
                                   // stack-lands-before-peel guarantee survives retuning
// The deck itself travels the ring. Every card starts the sweep TOGETHER at
// 12 o'clock and moves clockwise at ONE constant rate, stopping dead at its own
// seat. Shared start + shared rate + linear easing means every in-flight card is
// at the same angle on every frame: they read as a single moving stack that
// deposits its bottom card at each seat it passes — not a fountain of cards
// flying from a point to park on a circle. Card 0 is laid immediately; the deck
// thins as it goes; cards 50/51 land overlapping seat 0 from above. DOM order is
// the stack order (card 0 bottom → 51 top), so laid cards always sit under the
// deck that is still passing over them.
const SWEEP_RATE = 340; // deg/s — full circle in ~1.03s
const sweepDur = (i: number) => seatAngle(i) / SWEEP_RATE;
// a laid card squares up its slop tilt just as it slides out from under the deck
const SETTLE_DUR = 0.3;
const FAN_END = FAN_START + sweepDur(COUNT - 1); // ≈ 2.05

const REVEAL_START = FAN_END + 0.12; // ring closes, a beat, then the flips
const REVEAL_STEP = 0.07;
const REVEAL_DUR = 0.42;

const REVEAL_END = REVEAL_START + (REVEAL_COUNT - 1) * REVEAL_STEP + REVEAL_DUR;

const NAME_AT = 1.4;       // resolves inside the ring while it is still closing
const LABEL_AT = REVEAL_END - 0.18;  // hand name lands as the last flip settles
const CONFETTI_AT = REVEAL_END + 0.05;
const HOLD = REVEAL_END + 0.95; // long enough to actually read the hand label
const CELEBRATE_HOLD = 1.15; // extra dwell when the deal earns confetti

// Server render and first client render must agree, so the deck starts from a
// fixed seed and is reshuffled on mount — see the boot effect below.
const SSR_SEED = 0xc0ffee;

// ── Forced hands (?hand= preview) ─────────────────────────────────────────────
// Full house or better is a ~1-in-590 deal, so the celebration tiers would be
// unpreviewable on honest randomness. ?hand=royal|straightflush|quads|fullhouse|
// flush|straight|trips|twopair|pair|highcard swaps a constructed hand into the
// reveal seats (the rest of the ring stays random). Preview-only: no param, no
// rigging.
const FORCE_TIER: Record<string, number> = {
  highcard: 0, pair: 1, twopair: 2, trips: 3, three: 3, straight: 4, flush: 5,
  fullhouse: 6, full: 6, boat: 6, quads: 7, four: 7, straightflush: 8, sf: 8,
  royal: 9, royalflush: 9,
};

// One small builder per hand tier. buildForcedHand used to be a single
// 80-line if/else ladder with a cognitive complexity of 89; the ladder is now
// a table, and each entry reads as the hand it makes.
type Deal = { pick: (n: number) => number; drawRanks: (n: number, excl: number[]) => number[] };

const isStraightSet = (ranks: number[]) => {
  const s = [...ranks].sort((a, b) => a - b);
  return (
    (s[4]! - s[0]! === 4 && new Set(s).size === 5) ||
    (s[0] === 2 && s[1] === 3 && s[2] === 4 && s[3] === 5 && s[4] === 14)
  );
};

/** five ranks from `high` downward, with the wheel (A-2-3-4-5) when high is 5 */
const runDown = (high: number) => (high === 5 ? [14, 2, 3, 4, 5] : [0, 1, 2, 3, 4].map((k) => high - k));

/** five random ranks that do NOT form a straight */
const nonStraightRanks = (d: Deal) => {
  let ranks: number[];
  do { ranks = d.drawRanks(5, []); } while (isStraightSet(ranks));
  return ranks;
};

/** one random suit per rank, nudged so they are never all the same */
const mixedSuits = (d: Deal, ranks: number[]) => {
  const suits = ranks.map(() => d.pick(4));
  if (new Set(suits).size === 1) suits[4] = (suits[4]! + 1) % 4;
  return ranks.map((rank, k) => ({ rank, suit: suits[k]! }));
};

/** a pair of `rank` in two distinct suits */
const pairOf = (d: Deal, rank: number): Card[] => {
  const s1 = d.pick(4);
  return [{ rank, suit: s1 }, { rank, suit: (s1 + 1 + d.pick(3)) % 4 }];
};

/** three of `rank`, omitting one random suit */
const tripsOf = (d: Deal, rank: number): Card[] => {
  const omit = d.pick(4);
  return [0, 1, 2, 3].filter((s) => s !== omit).map((suit) => ({ rank, suit }));
};

const kicker = (d: Deal, rank: number): Card => ({ rank, suit: d.pick(4) });

const HAND_BUILDERS: Record<number, (d: Deal, suit: number) => Card[]> = {
  9: (_d, suit) => [14, 13, 12, 11, 10].map((rank) => ({ rank, suit })),
  8: (d, suit) => runDown(5 + d.pick(9)).map((rank) => ({ rank, suit })), // 5..13 — ace-high would be the royal
  7: (d) => { const [quad, k] = d.drawRanks(2, []); return [...[0, 1, 2, 3].map((suit) => ({ rank: quad!, suit })), kicker(d, k!)]; },
  6: (d) => { const [trip, pair] = d.drawRanks(2, []); return [...tripsOf(d, trip!), ...pairOf(d, pair!)]; },
  5: (d, suit) => nonStraightRanks(d).map((rank) => ({ rank, suit })),
  4: (d) => mixedSuits(d, runDown(5 + d.pick(10))), // 5..14, wheel through broadway
  3: (d) => { const [trip, k1, k2] = d.drawRanks(3, []); return [...tripsOf(d, trip!), kicker(d, k1!), kicker(d, k2!)]; },
  2: (d) => { const [r1, r2, k] = d.drawRanks(3, []); return [...pairOf(d, r1!), ...pairOf(d, r2!), kicker(d, k!)]; },
  1: (d) => { const [p, k1, k2, k3] = d.drawRanks(4, []); return [...pairOf(d, p!), kicker(d, k1!), kicker(d, k2!), kicker(d, k3!)]; },
  0: (d) => mixedSuits(d, nonStraightRanks(d)),
};

function buildForcedHand(kind: string, rng: () => number): Card[] | null {
  const key = kind.toLowerCase().replace(/[^a-z]/g, "");
  const tier = FORCE_TIER[key];
  if (tier === undefined) return null;

  const pick = (n: number) => Math.floor(rng() * n);
  const drawRanks = (n: number, excl: number[]) => {
    const out: number[] = [];
    while (out.length < n) {
      const r = 2 + pick(13);
      if (!excl.includes(r) && !out.includes(r)) out.push(r);
    }
    return out;
  };

  const hand = HAND_BUILDERS[tier]!({ pick, drawRanks }, pick(4));
  // A construction bug must degrade to an honest deal, never a wrong label.
  return classifyFive(hand).tier === tier ? hand : null;
}

// Glow strength behind a revealed card, by hand tier.
const GLOW_ALPHA = [0, 0, 0.35, 0.35, 0.6, 0.6, 0.85, 0.85, 1, 1] as const;

// Which seats flip face-up: evenly spread, ALWAYS anchored at seat 0. A closed
// ring of flat cards cannot overlap cyclically — z-order is a strict ladder, so
// somewhere one card must sit under both neighbours, and that seam is
// structurally the first-laid card, seat 0. Anchoring the reveals at seat 0
// pulls the seam card out of the ring plane (radius + scale + zIndex 10, first
// to flip), so the double-overlap never survives to be seen and the remaining
// ring is a perfect one-directional spiral. The CARDS stay fully random; only
// the frame positions are fixed. `rank` maps seat → flip order.
const REVEAL_SEATS = (() => {
  const gap = COUNT / REVEAL_COUNT;
  const order: number[] = [];
  const rank = new Map<number, number>();
  for (let k = 0; k < REVEAL_COUNT; k++) {
    const seat = Math.round(k * gap) % COUNT;
    order.push(seat);
    rank.set(seat, k);
  }
  return { order, rank };
})();

// ── Splash ────────────────────────────────────────────────────────────────────
export default function Splash({ onComplete }: { onComplete: () => void }) {
  const reduce = useReducedMotion() ?? false;
  const boxRef = useRef<HTMLDivElement>(null);
  // `go` holds the whole choreography at its resting pose until the main thread
  // is actually free. Framer's delays run on wall-clock time, so starting at
  // mount means the opening beats tick away while the browser is still parsing
  // bundles and hydrating — you never see them, and the fan appears to jump in
  // part-way. Seed and go land in one state object so this costs one re-render.
  const [boot, setBoot] = useState<{ seed: number; go: boolean; force: string | null }>({
    seed: SSR_SEED,
    go: false,
    force: null,
  });
  const { seed, go, force } = boot;

  const onCompleteRef = useRef(onComplete);
  const doneRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    try {
      onCompleteRef.current();
    } catch (err) {
      // a failed hand-off must never latch the splash shut — un-latch so the
      // next skip or timer can retry the escape, and let the error surface
      doneRef.current = false;
      throw err;
    }
  }, []);

  // Hold until the fonts have resolved and a frame has actually rendered, then
  // reshuffle and release the animation in the same pass. Waiting on fonts stops
  // a swap from reflowing the name mid-flight; waiting on a rAF stops the intro
  // from starting against a blocked main thread. The race caps the wait so a
  // slow font can never stall the intro.
  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    const release = () => {
      if (cancelled) return;
      raf = requestAnimationFrame(() => {
        if (!cancelled)
          setBoot({
            seed: (Math.random() * 0xffffffff) >>> 0,
            go: true,
            force: new URLSearchParams(window.location.search).get("hand"),
          });
      });
    };

    const fonts = document.fonts;
    if (fonts?.ready) {
      Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 600))]).then(release);
    } else {
      release();
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  const revealRank = REVEAL_SEATS.rank;

  // A fresh 52-card shuffle each load, so the ring — and the five cards that
  // turn over — are different every time. With ?hand=, the constructed hand is
  // swapped into the reveal seats; the ring around it stays random.
  const deck = useMemo(() => {
    const cards = fullDeck();
    shuffleInPlace(cards, mulberry32(seed));
    const forced = force ? buildForcedHand(force, mulberry32(seed ^ 0x51ed270b)) : null;
    if (forced) {
      forced.forEach((card, k) => {
        const seat = REVEAL_SEATS.order[k]!;
        const at = cards.findIndex((c) => c.rank === card.rank && c.suit === card.suit);
        const tmp = cards[seat]!;
        cards[seat] = cards[at]!;
        cards[at] = tmp;
      });
    }
    return cards.slice(0, COUNT);
  }, [seed, force]);

  // The five revealed cards ARE a poker hand — classify it. This is what the
  // poker-calculations addon's evaluateBestHand() reports server-side; the
  // native binary cannot load in the browser, so the JS mirror does it here.
  const hand = useMemo(
    () => classifyFive(REVEAL_SEATS.order.map((seat) => deck[seat]!)),
    [deck],
  );
  const celebrate = hand.tier >= 6; // full house or better earns confetti

  // Fit the whole composition to the viewport. CSS cannot divide a length by a
  // number to get a scale factor, so the ratio is measured here instead. Written
  // imperatively to the container — never through state — so a mid-intro window
  // drag cannot re-render 80-odd motion components per resize event. React never
  // writes this style key itself (it isn't in the JSX), so the imperative value
  // survives every React commit. Layout effect: measured before first paint.
  useLayoutEffect(() => {
    const fit = () => {
      const s = Math.min(1, (window.innerWidth - 32) / BOX, (window.innerHeight - 48) / BOX);
      if (boxRef.current) boxRef.current.style.transform = `scale(${s})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Clock the hand-off from the moment the intro is actually released, not from
  // mount, or a slow boot eats the end of the animation.
  useEffect(() => {
    if (!go) return;
    const hold = HOLD + (celebrate ? CELEBRATE_HOLD : 0);
    const timer = setTimeout(finish, reduce ? 900 : hold * 1000);
    return () => clearTimeout(timer);
  }, [go, reduce, celebrate, finish]);

  // Any deliberate input cuts the intro short.
  useEffect(() => {
    window.addEventListener("pointerdown", finish);
    window.addEventListener("keydown", finish);
    window.addEventListener("wheel", finish, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("keydown", finish);
      window.removeEventListener("wheel", finish);
    };
  }, [finish]);

  // Reduced motion snaps every transform to its final pose (duration 0) and the
  // root crossfades in instead. Compressing the delays but keeping durations
  // would cram a 350° spin, a 210px flight and a 3D flip into one 300ms burst —
  // MORE violent motion than the intro it replaces, the opposite of the request.
  const t = (delay: number, duration: number, curve = easeOut) =>
    reduce ? { delay: 0, duration: 0 } : { delay, duration, ease: curve };

  return (
    <m.div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden select-none"
      style={{ background: "var(--color-bg)" }}
      initial={{ opacity: reduce ? 0 : 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeIn" } }}
    >
      {/* Purple wash. A radial gradient is already soft, so it carries no blur
          filter — a 70vmax blur(60px) is a full-screen GPU pass every frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: "90vmax",
          height: "90vmax",
          background:
            "radial-gradient(circle, rgb(var(--brand-purple-rgb) / 0.15) 0%, rgb(var(--brand-purple-rgb) / 0.05) 34%, transparent 60%)",
        }}
      />

      <div
        ref={boxRef}
        style={{
          position: "relative",
          width: BOX,
          height: BOX,
          flexShrink: 0,
          // transform is written imperatively by the fit effect — keep it out
          // of JSX so React and the effect never fight over the same style key
        }}
      >
        {/* Faint guide ring the fan seats itself onto */}
        <m.div
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            width: RING_R * 2,
            height: RING_R * 2,
            marginLeft: -RING_R,
            marginTop: -RING_R,
            border: "1px solid rgb(var(--brand-purple-rgb) / 0.14)",
          }}
          initial={reduce ? false : { opacity: 0, scale: 0.85 }}
          animate={go ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }}
          transition={t(LIFT_START, 0.9)}
        />

        {/* The deck fades in HERE, as one group — not per card. 52 stacked
            per-card opacities alpha-composite (1 − (1−a)³⁶), so the pile reads
            ~90% solid within two frames: a pop, not a fade. Group opacity is a
            true fade, and one tween replaces 52. The 0.94→1 scale gives the
            arrival a little weight; it lands before the rise gets going. */}
        <m.div
          className="absolute inset-0"
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={go ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94 }}
          transition={{
            opacity: t(APPEAR, APPEAR_DUR),
            scale: t(APPEAR, APPEAR_DUR + 0.1),
          }}
        >
          {deck.map((card, i) => {
            const angle = seatAngle(i);
            const upright = uprightRotate(angle); // computed here, not inside the JSX
            const rank = revealRank.get(i);
            const isRevealed = rank !== undefined;
            const revealAt = REVEAL_START + (rank ?? 0) * REVEAL_STEP;
            const slop = stackSlop(i);

            // The lift's two motions — the rise (y) and the slop settle (rotate)
            // — never overlap in time, so they fold into ONE four-keyframe
            // transform: rest → risen → (hold) → laid. Keyframe offsets carry
            // the timing, a per-segment ease array carries the curves.
            const liftStart = LIFT_START + i * LIFT_STEP;
            const settleStart = Math.max(FAN_START, FAN_START + sweepDur(i) - 0.1);
            const liftSpan = settleStart + SETTLE_DUR - liftStart;
            const atRest = `translateY(0px) rotate(${slop}deg)`;
            const risen = `translateY(${-RING_R}px) rotate(${slop}deg)`;
            const laid = `translateY(${-RING_R}px) rotate(0deg)`;

            return (
              <m.div
                key={i}
                // arm — pivots about the canvas centre, carrying the card round
                // the ring. All arms launch together at FAN_START and rotate at
                // the same linear rate; each stops at its own seat, so the
                // superposition of in-flight cards IS the travelling deck.
                //
                // Animated as a `transform` STRING, not `rotate`: framer only
                // hands opacity/clipPath/filter/transform to WAAPI. Individual
                // transform props run on its JS frame loop, which meant 104
                // style.transform writes + a full re-layerize every frame on the
                // main thread; as a string the whole sweep runs on the
                // compositor and cannot stutter when a script task lands mid-
                // flight. All 52 WAAPI animations are created in the one go
                // commit, so they share a timeline start and the shared-rate
                // sync of the travelling deck holds.
                //
                // Measured, not assumed (CDP traces, real framer engine): on
                // desktop this saves ~1ms of main thread per frame — both paths
                // already hold 60fps there. Under 4x CPU throttle the main
                // thread is no cheaper, but the compositor keeps drawing every
                // vsync (45/45) where the JS path drew 23-42: the sweep stays
                // smooth on a starved phone. No will-change: it measured as no
                // benefit and slightly worse (more persistent layers).
                //
                // zIndex is promoted only at the flip beat (duration 0 = a
                // scheduled set, no tween): baked from mount, sweeping cards
                // visibly dived UNDER the five still-anonymous reveal seats.
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: CARD_W,
                  height: CARD_H,
                  marginLeft: -CARD_W / 2,
                  marginTop: -CARD_H / 2,
                  zIndex: 1,
                }}
                initial={reduce ? false : { transform: "rotate(0deg)", zIndex: 1 }}
                animate={{
                  transform: `rotate(${go ? angle : 0}deg)`,
                  zIndex: go && isRevealed ? 10 : 1,
                }}
                transition={{
                  transform: t(FAN_START, sweepDur(i), linear),
                  zIndex: { delay: reduce ? 0 : revealAt, duration: 0 },
                }}
              >
                <m.div
                  // the lift: the stack rides out of the centre to the ring as one
                  // tight unit. The stack slop is a local tilt here, so it never
                  // becomes a positional offset. In-flight cards KEEP their tilt —
                  // the travelling deck stays a loose stack — and each card
                  // squares up as it is deposited, starting just before its seat.
                  // Same WAAPI reasoning as the arm: one transform string.
                  style={{ position: "relative", width: "100%", height: "100%" }}
                  initial={reduce ? false : { transform: atRest }}
                  animate={{ transform: go ? [atRest, risen, risen, laid] : atRest }}
                  transition={{
                    transform: reduce
                      ? { delay: 0, duration: 0 }
                      : {
                          delay: liftStart,
                          duration: liftSpan,
                          times: [0, LIFT_DUR / liftSpan, (settleStart - liftStart) / liftSpan, 1],
                          ease: [glide, linear, easeOut],
                        },
                  }}
                >
                  {/* Only the cards that actually turn over carry the flip rig.
                      A 3D context and a second painted face on all 52 is most of
                      the mount cost for something 31 of them never show. */}
                  {isRevealed ? (
                    <m.div
                      // the pull-out: a shown card takes a little extra radius,
                      // grows a touch to become focal, and cancels its arm's
                      // rotation so the face reads upright.
                      style={{ width: "100%", height: "100%", perspective: 700 }}
                      initial={reduce ? false : { y: 0, rotate: 0, scale: 1 }}
                      animate={
                        go
                          ? { y: -LIFT, rotate: upright, scale: 1.12 }
                          : { y: 0, rotate: 0, scale: 1 }
                      }
                      transition={{
                        y: t(revealAt, REVEAL_DUR, settle),
                        scale: t(revealAt, REVEAL_DUR, settle),
                        rotate: t(revealAt, REVEAL_DUR),
                      }}
                    >
                      {/* hand-strength glow — pre-painted gradient, opacity only */}
                      {GLOW_ALPHA[hand.tier]! > 0 && (
                        <m.div
                          aria-hidden
                          style={{
                            position: "absolute",
                            inset: -18,
                            borderRadius: 18,
                            pointerEvents: "none",
                            background:
                              hand.tier >= 8
                                ? "radial-gradient(circle, rgb(var(--brand-purple-rgb) / 0.55) 0%, rgb(var(--brand-green-rgb) / 0.24) 46%, transparent 72%)"
                                : "radial-gradient(circle, rgb(var(--brand-green-rgb) / 0.42) 0%, transparent 70%)",
                          }}
                          initial={reduce ? false : { opacity: 0 }}
                          animate={{ opacity: go ? GLOW_ALPHA[hand.tier]! : 0 }}
                          // synced to the hand being NAMED, sweeping the ring in
                          // flip order — blooming per-flip leaked the verdict
                          // before the fifth card's face even existed
                          transition={t(LABEL_AT + (rank ?? 0) * 0.05, 0.5)}
                        />
                      )}
                      <m.div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                          transformStyle: "preserve-3d",
                        }}
                        initial={reduce ? false : { rotateY: 0 }}
                        animate={{ rotateY: go ? 180 : 0 }}
                        transition={t(revealAt, REVEAL_DUR, ease)}
                      >
                        <CardBack />
                        <CardFace rank={card.rank} suit={card.suit} />
                      </m.div>
                    </m.div>
                  ) : (
                    <CardBack />
                  )}
                </m.div>
              </m.div>
            );
          })}
        </m.div>

        {/* Name sits in the hole of the fan and never rotates with it. Animated
            with transform/opacity only — letter-spacing was forcing layout on
            every frame, right in the middle of the sweep. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <m.h1
            className="font-display font-black tracking-tight leading-none whitespace-nowrap"
            style={{ fontSize: 30, color: "var(--color-accent-dim)", letterSpacing: "-0.03em" }}
            initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
            animate={go ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 10, scale: 0.97 }}
            transition={t(NAME_AT, 0.8)}
          >
            Devom Brahmbhatt
          </m.h1>
          <m.p
            className="font-mono whitespace-nowrap"
            style={{ fontSize: 11, marginTop: 10, color: "var(--color-muted)", letterSpacing: "0.14em" }}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={go ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            transition={t(NAME_AT + 0.15, 0.6)}
          >
            TRADER · ENGINEER · RESEARCHER
          </m.p>

          {/* the dealt hand, named as the last flip settles — this is the
              intro's payoff line, so it reads as a verdict, not a caption:
              bold, bigger than the subtitle, ink-white floor. The green
              strength ladder rides on top so color still carries meaning. */}
          <m.p
            className="font-mono whitespace-nowrap font-bold"
            style={{
              fontSize: 15,
              marginTop: 18,
              letterSpacing: "0.18em",
              // ladder aligned with GLOW_ALPHA's pairs — the floor is ink,
              // never muted: an ordinary deal is still worth announcing
              color:
                hand.tier >= 6
                  ? "var(--color-secondary)"
                  : hand.tier >= 4
                    ? "var(--color-secondary-dim)"
                    : hand.tier >= 2
                      ? "rgb(var(--brand-green-rgb) / 0.78)"
                      : "var(--color-ink)",
              textShadow: celebrate ? "0 0 20px rgb(var(--brand-green-rgb) / 0.55)" : undefined,
            }}
            initial={reduce ? false : { opacity: 0, y: 8, scale: 0.94 }}
            animate={go ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 8, scale: 0.94 }}
            transition={t(LABEL_AT, 0.6, settle)}
          >
            {celebrate ? `♠ ${hand.name.toUpperCase()} ♠` : hand.name.toUpperCase()}
          </m.p>
        </div>
      </div>

      {/* confetti for a full house or better — canvas, mounts only when earned */}
      {go && celebrate && !reduce && (
        <SplashConfetti
          delayMs={CONFETTI_AT * 1000}
          count={hand.tier >= 9 ? 320 : hand.tier >= 8 ? 240 : 150}
          rain={hand.tier >= 8}
        />
      )}

      {/* skip hint */}
      <m.p
        className="absolute font-mono"
        style={{
          bottom: "max(1.75rem, env(safe-area-inset-bottom, 0px) + 1rem)",
          fontSize: "0.58rem",
          letterSpacing: "0.16em",
          color: "var(--color-muted)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: go ? 0.45 : 0 }}
        transition={t(2.0, 0.6)}
      >
        <span className="on-mouse">CLICK</span>
        <span className="on-touch">TAP</span>{" "}TO SKIP
      </m.p>
    </m.div>
  );
}
