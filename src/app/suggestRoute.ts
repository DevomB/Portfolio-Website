/**
 * "Did you mean" for the 404 page: pick the real route that looks most like
 * the one that missed. Pure function so it can be tested without React.
 */

const MIN_SCORE = 0.5;

function normalize(path: string): string {
  return path
    .toLowerCase()
    .split("?")[0]
    .replace(/#/g, "/")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

function lastSegment(normalized: string): string {
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 0 : 1 - levenshtein(a, b) / max;
}

/** Score how well `candidate` explains the missed `path`, 0–1. */
function score(path: string, candidate: string): number {
  const p = normalize(path);
  const c = normalize(candidate);
  if (!p || !c) return 0;

  const pLast = lastSegment(p);
  const cLast = lastSegment(c);

  // "terms-of-service" → "terms", "poker" → "poker-calculations": one segment
  // contains the other. Require 3+ chars so "a" doesn't match everything.
  const contains =
    pLast.length >= 3 &&
    cLast.length >= 3 &&
    (pLast.includes(cLast) || cLast.includes(pLast));

  return Math.max(similarity(p, c), similarity(pLast, cLast), contains ? 0.9 : 0);
}

/**
 * Returns the best-matching route, or "/" when nothing is close enough to
 * be an honest suggestion.
 */
export function suggestRoute(path: string, candidates: readonly string[]): string {
  let best = "/";
  let bestScore = MIN_SCORE;
  for (const candidate of candidates) {
    const s = score(path, candidate);
    if (s > bestScore) {
      bestScore = s;
      best = candidate;
    }
  }
  return best;
}
