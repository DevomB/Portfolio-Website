"use client";

import { useEffect, useState, type RefObject } from "react";

/** The rendered width of an element in CSS px, kept current by a
 *  ResizeObserver; `fallback` on the server and until the first measurement.
 *  The demos' SVG charts draw at this width, one unit to a pixel, so an 11px
 *  label is 11px on a phone as on a desk instead of shrinking with the page. */
export function useWidth(ref: RefObject<Element | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
