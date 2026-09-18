/* Number formatting the Pallas demos share. */

/** Signed whole dollars: "+$1,240", "−$310", "$0". */
export const money = (v: number) =>
  (v < 0 ? "−" : v > 0 ? "+" : "") + "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Signed Sharpe to two places: "+1.20", "-0.35". */
export const sharpeFmt = (v: number) => (v > 0 ? "+" : "") + v.toFixed(2);

/** Gridline values for a chart axis over [lo, hi]: at most five, on a
 *  1-2-2.5-5 step, and never two that `format` writes the same way — a $0.40
 *  span in whole dollars gets one line, not "$1 $1 $1 $0". */
export function axisTicks(lo: number, hi: number, format: (v: number) => string): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [lo];
  for (let mag = Math.pow(10, Math.floor(Math.log10(span / 4))); mag <= span * 10; mag *= 10) {
    for (const step of [1, 2, 2.5, 5].map((m) => m * mag)) {
      if (step < span / 4) continue;
      const first = Math.ceil(lo / step);
      const out: number[] = [];
      for (let k = first; k * step <= hi; k++) out.push(k * step);
      const labels = out.map(format);
      if (new Set(labels).size === labels.length) return out;
    }
  }
  return [lo];
}
