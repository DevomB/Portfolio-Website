"use client";

import { useEffect, useState } from "react";

/** For a sideways-scrolling table: a callback ref for its scroller, and
 *  whether there is more to the right of what it shows — what the right-edge
 *  fade says. Follows scrolling and the size of both the box and its content,
 *  and attaches whenever the scroller mounts (tables that appear after a run
 *  included). */
export function useMoreRight(): [(el: HTMLElement | null) => void, boolean] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    if (!el) return;
    const check = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", check, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener("scroll", check); };
  }, [el]);
  return [setEl, more];
}
