/* Number formatting the Pallas demos share. */

/** Signed whole dollars: "+$1,240", "−$310", "$0". */
export const money = (v: number) =>
  (v < 0 ? "−" : v > 0 ? "+" : "") + "$" + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

/** Signed Sharpe to two places: "+1.20", "-0.35". */
export const sharpeFmt = (v: number) => (v > 0 ? "+" : "") + v.toFixed(2);
