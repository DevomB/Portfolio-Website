"use client";

import { useSyncExternalStore } from "react";

/* The root font size in CSS px: 16 up to a 1600px viewport, then 1vw, up to
   1.75× (see `html` in globals.css). What the page sizes in rem scales on its
   own; charts that draw in px take their sizes from this, so their labels
   stay 0.6875rem (11px at 16) and they scale with everything else. */
const subscribe = (onChange: () => void) => {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
};
const read = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const onServer = () => 16;

/** CSS px per rem, kept current as the viewport changes. */
export function useRem(): number {
  return useSyncExternalStore(subscribe, read, onServer);
}
