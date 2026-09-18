"use client";

import { useEffect, useState } from "react";
import { useLoaded } from "@/app/(home)/LoadedContext";

// A log of the SITE, in the order a real server prints it. Two lines are live:
// {host} is wherever this is actually served from (localhost:3000, devomb.com,
// a preview URL), and the GET line reports this page's real path and measured
// response time from the Navigation Timing API.
const LOG_LINES = [
  { delay: 0,    type: "info",   text: "> booting devomb.core" },
  { delay: 550,  type: "module", text: "> Next 16 · Tailwind · Framer" },
  { delay: 1150, type: "ok",     text: "> routes compiled" },
  { delay: 1750, type: "info",   text: "> listening on {host}" },
  { delay: 2350, type: "ok",     text: "> GET {path} 200 · {ms} ms" },
  { delay: 2950, type: "ready",  text: "> ready ✓" },
];

// A booted, healthy server logs in green. Only the narration lines stay muted.
const lineColor: Record<string, string> = {
  info:   "var(--color-muted)",
  module: "var(--color-secondary)",
  ok:     "var(--color-secondary)",
  ready:  "var(--color-secondary)",
};

/** The live values the log prints: real host, real path, real measured response. */
function readLiveValues() {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const ms = nav ? Math.round(nav.responseEnd - nav.requestStart) : 0;
  return {
    host: window.location.host || "localhost",
    path: window.location.pathname || "/",
    ms: ms > 0 ? ms : 18,
  };
}

/** Reveal the log lines on their timers once the page is actually on screen. */
function useLogTimeline(loaded: boolean) {
  const [visible, setVisible] = useState<number[]>([]);
  const [live, setLive] = useState({ host: "localhost", path: "/", ms: 0 });

  useEffect(() => {
    if (!loaded) return;
    const timers = LOG_LINES.map((line, i) =>
      setTimeout(() => {
        // read the real values as the first line lands — well before the
        // lines that print them
        if (i === 0) setLive(readLiveValues());
        setVisible((v) => [...v, i]);
      }, line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [loaded]);

  return { visible, live };
}

export default function ServerLog() {
  // The page is mounted beneath the splash from the first render; the log
  // waits for the reveal so its lines are not all spent before anyone sees it.
  const { visible, live } = useLogTimeline(useLoaded());

  const render = (text: string) =>
    text
      .replace("{host}", live.host)
      .replace("{path}", live.path)
      .replace("{ms}", String(live.ms));

  return (
    <div
      className="w-full rounded-xl border border-accent/25 bg-surface font-mono text-fluid-xs leading-relaxed overflow-hidden"
      aria-hidden
    >
      {/* window chrome: file name reads from the left edge, lights on the right */}
      <div className="flex items-center border-b border-accent/20 bg-surface px-4 py-2.5">
        <span className="font-medium text-ink">server.log</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" />
          <span className="h-2.5 w-2.5 rounded-full bg-warn" />
          <span className="h-2.5 w-2.5 rounded-full bg-ok" />
        </span>
      </div>
      <div className="p-4 space-y-1 min-h-[9rem]">
        {LOG_LINES.map((line, i) =>
          visible.includes(i) ? (
            <p key={i} style={{ color: lineColor[line.type] ?? "var(--color-muted)" }}>
              {render(line.text)}
            </p>
          ) : null
        )}
      </div>
    </div>
  );
}
