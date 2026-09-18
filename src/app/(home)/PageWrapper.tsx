"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Splash from "@/app/(home)/Splash";
import { LoadedContext } from "@/app/(home)/LoadedContext";

type Stage = "checking" | "intro" | "ready";

// The splash is the front door, and a visit walks through it once: on the
// first hard load of "/" in a browser session. Three signals decide it.
//  - The navigation entry: this document was loaded at "/". Landing on an
//    inner page and clicking home is client-side navigation, and never plays.
//  - Module scope: this JS context has not played it yet (home -> a demo ->
//    home again keeps the context).
//  - sessionStorage: this session has not played it yet, so a reload of "/"
//    goes straight to the page. If storage throws, it counts as unplayed.
// `?hand=` previews always play — they are pointless without it.
let introPlayedThisLoad = false;
const SESSION_KEY = "devomb.splash";

function loadedAtHome(): boolean {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  try {
    return new URL(nav?.name ?? window.location.href).pathname === "/";
  } catch {
    return true;
  }
}

function playedThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "played";
  } catch {
    return false;
  }
}

function shouldPlay(): boolean {
  if (new URLSearchParams(window.location.search).has("hand")) return true;
  const play = !introPlayedThisLoad && loadedAtHome() && !playedThisSession();
  if (play) {
    introPlayedThisLoad = true;
    try { window.sessionStorage.setItem(SESSION_KEY, "played"); } catch {}
  }
  return play;
}

export default function PageWrapper({ children }: { children: ReactNode }) {
  // Any click, key or scroll skips the splash.
  //
  // The page content is mounted from the very first render, underneath.
  // It used to mount at the hand-off, which put the entire page mount — 250+
  // elements, 48 motion components, the hero's canvas measurements, first
  // layout — inside the same synchronous task as the click that skipped the
  // splash: a ~90 ms freeze of the moving ring (~600 ms on a throttled CPU).
  // Pre-mounting moves all of that to hydration, where nothing is on screen,
  // and the hand-off becomes two opacity tweens. It also means the `/` HTML
  // actually contains the page for crawlers and link unfurlers.
  //
  // Content that would otherwise play its entrance unseen (the hero, the
  // server log) waits on LoadedContext instead.
  //
  // The splash itself still mounts one effect-flush after hydration rather
  // than in the SSR HTML: its first client render must agree with the server
  // on things the server cannot know (reduced-motion, viewport fit). Until
  // then a static cover — same black as the splash — sits over the page, in
  // the SSR HTML too, so there is never a flash of content before JS.
  const [stage, setStage] = useState<Stage>("checking");

  // decided once per mount: shouldPlay() spends the session's one play, and
  // dev Strict Mode runs this effect twice on the same mount
  const play = useRef<boolean | null>(null);
  useEffect(() => {
    play.current ??= shouldPlay();
    setStage(play.current ? "intro" : "ready");
  }, []);

  const ready = stage === "ready";

  return (
    <LoadedContext.Provider value={ready}>
      {stage === "checking" && (
        <div aria-hidden className="fixed inset-0 z-[200]" style={{ background: "var(--color-bg)" }} />
      )}
      <AnimatePresence>
        {stage === "intro" && (
          <Splash key="loading" onComplete={() => setStage("ready")} />
        )}
      </AnimatePresence>
      {/* inert while hidden: no focus, no pointer, out of the a11y tree.
          Deliberately NOT animated. The splash above is opaque and fades
          itself out, which already reveals this; fading the page in as well
          composited the whole document a second time for no visual gain, and
          the two crossfading translucent layers dipped the brightness in the
          middle of the hand-off. */}
      <div inert={!ready}>{children}</div>
    </LoadedContext.Provider>
  );
}
