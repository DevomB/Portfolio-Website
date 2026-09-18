"use client";

import { m } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/app/(chrome)/Button";
import ServerLog from "@/app/(home)/ServerLog";
import { useInkAlign } from "@/app/(home)/useInkAlign";
import { useLoaded } from "@/app/(home)/LoadedContext";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%!&" as const;
const NAME = "Devom Brahmbhatt";
const TITLE_LINES = ["Trader", "Engineer", "Researcher"] as const;

const SQL_GHOSTS = [
  { text: "SELECT * FROM projects WHERE featured = true ORDER BY created_at DESC;", top: "12%", left: "-1%", rotate: -1.5 },
  { text: "EXPLAIN ANALYZE SELECT * FROM events WHERE created_at > NOW() - INTERVAL '1 hour' AND user_id = $1;", top: "80%", right: "0%", rotate: 1 },
];

function useScramble(text: string) {
  const [display, setDisplay] = useState(text);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const frameRef = useRef(0);

  const scramble = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    frameRef.current = 0;
    intervalRef.current = setInterval(() => {
      const resolved = Math.floor(frameRef.current / 2);
      setDisplay(
        text.split("").map((char, i) => {
          if (char === " ") return " ";
          if (i < resolved) return char;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join("")
      );
      frameRef.current++;
      if (resolved >= text.length) {
        clearInterval(intervalRef.current);
        setDisplay(text);
      }
    }, 28);
  }, [text]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  return { display, scramble };
}

const ease = [0.21, 0.47, 0.32, 0.98] as [number, number, number, number];

export default function HeroSection() {
  const { display: nameDisplay, scramble } = useScramble(NAME);
  // The hero is mounted beneath the splash from the first render, so its
  // entrance is gated on the reveal instead of playing unseen under the
  // cover. `initial: false` holds the hidden pose statically until then.
  const loaded = useLoaded();
  const fade = (delay: number) => ({
    initial: false as const,
    animate: loaded ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 },
    transition: { duration: 0.7, delay, ease },
  });
  const nameRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useInkAlign(titleRef, nameRef, { target: TITLE_LINES[0][0], reference: NAME[0] }); // ink-edge align title to name

  return (
    <section className="relative hero-fold overflow-hidden flex items-center">
      {/* background wash */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* teal — top right */}
        <div
          className="absolute rounded-full"
          style={{
            width: "55vw", height: "55vw",
            top: "-22%", right: "-10%",
            background: "radial-gradient(circle, rgb(var(--brand-purple-rgb) / 0.22) 0%, transparent 68%)",
            filter: "blur(52px)",
          }}
        />
        {/* joker green — bottom left */}
        <div
          className="absolute rounded-full"
          style={{
            width: "42vw", height: "42vw",
            bottom: "-15%", left: "-6%",
            background: "radial-gradient(circle, rgb(var(--brand-green-rgb) / 0.16) 0%, transparent 68%)",
            filter: "blur(60px)",
          }}
        />
        {/* teal — mid accent */}
        <div
          className="absolute rounded-full"
          style={{
            width: "22vw", height: "22vw",
            top: "42%", left: "28%",
            background: "radial-gradient(circle, rgb(var(--brand-purple-rgb) / 0.07) 0%, transparent 70%)",
            filter: "blur(44px)",
          }}
        />
      </div>

      {/* SQL ghost text */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {SQL_GHOSTS.map((g, i) => (
          <span
            key={i}
            className="sql-ghost absolute text-[0.55rem]"
            style={{
              top: g.top,
              left: "left" in g ? (g as typeof g & { left: string }).left : undefined,
              right: "right" in g ? (g as typeof g & { right: string }).right : undefined,
              transform: `rotate(${g.rotate}deg)`,
            }}
          >
            {g.text}
          </span>
        ))}
      </div>

      <div className="relative w-full grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_400px] lg:gap-24">
        <div>
          <m.h2
            ref={nameRef}
            {...fade(0)}
            className="font-display font-semibold tracking-tight mb-5 cursor-default select-none"
            style={{ fontSize: "var(--text-2xl)", color: "var(--color-ink)" }}
            onMouseEnter={scramble}
          >
            {nameDisplay}
          </m.h2>

          <m.h1
            ref={titleRef}
            {...fade(0.1)}
            className="font-display font-black leading-[0.93] tracking-tighter mb-8"
            style={{ fontSize: "clamp(2.75rem, min(5.5vw + 1rem, 13vh), 6rem)", color: "var(--color-accent)" }}
          >
            {TITLE_LINES[0]}<br />{TITLE_LINES[1]}<br />{TITLE_LINES[2]}
          </m.h1>

          <m.p
            {...fade(0.2)}
            className="mb-10 leading-relaxed"
            style={{ fontSize: "var(--text-base)", color: "var(--color-muted)", maxWidth: "38ch" }}
          >
            Building resilient APIs, data-intensive systems, and applied simulations.
            Based in Eastvale, CA.
          </m.p>

          <m.div {...fade(0.3)} className="flex items-center gap-3">
            <ButtonLink href="#projects">View Projects</ButtonLink>
            <ButtonLink href="https://github.com/DevomB" variant="ghost">GitHub</ButtonLink>
          </m.div>
        </div>

        <m.div
          {...fade(0.35)}
          className="hidden lg:block"
        >
          <ServerLog />
        </m.div>
      </div>
    </section>
  );
}
