"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Rooted at "/" so they work from every page; on home itself Next treats
// them as a hash-only change and the page smooth-scrolls to the section.
const navLinks = [
  { label: "About", href: "/#about" },
  { label: "Projects", href: "/#projects" },
];

function LiveClock() {
  const [time, setTime] = useState("");
  const [tzAbbr, setTzAbbr] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const t = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const abbr =
        new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
          .formatToParts(now)
          .find((p) => p.type === "timeZoneName")?.value ?? "";
      setTime(t);
      setTzAbbr(abbr);
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  if (!time) return null;

  return (
    <span className="hidden items-center gap-1.5 font-mono text-fluid-xs text-muted lg:flex">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-secondary"
        style={{ boxShadow: "0 0 6px rgb(var(--brand-green-rgb) / 0.6)" }}
        aria-hidden
      />
      <span className="tabular-nums">{time}</span>
      {/* 1px spacer: time -> zone reads as one unit (6 + 1 + 6 = 13px) */}
      <span className="inline-block w-px" aria-hidden />
      <span>{tzAbbr}</span>
    </span>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-[100] transition-all duration-200 ${
        scrolled
          ? "border-b border-accent/25 bg-bg/90 backdrop-blur-xl shadow-[0_1px_0_rgb(var(--brand-purple-rgb) / 0.08)]"
          : "bg-transparent"
      }`}
    >
      <div className="relative mx-auto flex h-14 w-[min(100%-2*var(--shell-inline),76rem)] items-center justify-between gap-6 px-[var(--shell-inline)]">
        {/* logo */}
        <Link
          href="/"
          className="font-wordmark text-fluid-sm font-extrabold tracking-tight text-ink transition-colors hover:text-accent"
          style={{ fontVariationSettings: '"wdth" 125' }}
        >
          DEVOMB<span className="text-accent">.</span>COM
        </Link>

        {/* desktop nav */}
        <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 md:flex" aria-label="Primary">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3.5 py-1.5 font-display text-fluid-sm text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* right: clock + github */}
        <div className="hidden items-center gap-4 md:flex">
          <LiveClock />
          <Link
            href="https://github.com/DevomB"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-1.5 font-display text-fluid-xs font-medium text-ink transition-all hover:border-accent/40 hover:bg-accent-bg hover:text-accent-dim"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </Link>
        </div>

        {/* mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition hover:bg-surface hover:text-ink md:hidden"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* mobile drawer */}
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-14 z-[90] bg-ink/10 backdrop-blur-sm md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-14 z-[95] border-t border-border bg-bg shadow-card md:hidden">
            <nav className="flex flex-col gap-1 px-[var(--shell-inline)] py-4" aria-label="Mobile">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 font-display text-fluid-base font-medium text-ink hover:bg-surface"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 border-t border-border pt-3 px-3">
                <LiveClock />
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
