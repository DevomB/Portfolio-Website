/* Colour arithmetic for labels drawn on computed fills. */

/** WCAG relative luminance of an OKLCH colour (L 0..1, C, hue in degrees),
 *  clamped into sRGB the way a browser clips an out-of-gamut colour. */
export function oklchLuminance(L: number, C: number, hue: number): number {
  const h = (hue * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  const r = clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

/** Black or white, whichever reads on a fill of luminance `y`. The switch
 *  sits where the two tie (y ≈ 0.179), so either side clears 4.5:1. */
export const labelOn = (y: number) => (y > 0.179 ? "#000000" : "#ffffff");
