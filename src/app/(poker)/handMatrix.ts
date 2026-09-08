/* The 13×13 starting-hand matrix, shared by the Landscape API route and its
   terrain. Row = first rank, column = second rank, A..2. Diagonal = pairs,
   above it suited, below it offsuit — the layout every range chart uses. */

export const MATRIX_RANKS = "AKQJT98765432";
export const SUITS = ["s", "h", "d", "c"] as const;

export type Cell = { i: number; j: number };

export const cellIndex = (i: number, j: number) => i * 13 + j;
export const cellOf = (index: number): Cell => ({ i: Math.floor(index / 13), j: index % 13 });

/** "AKs", "AKo", "QQ" */
export function classLabel(i: number, j: number): string {
  const a = MATRIX_RANKS[i]!;
  const b = MATRIX_RANKS[j]!;
  if (i === j) return a + b;
  return i < j ? a + b + "s" : b + a + "o";
}

type Combo = [string, string];

/** the 6 ways to hold a pair of `r` */
function pairCombos(r: string): Combo[] {
  const out: Combo[] = [];
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([r + SUITS[a], r + SUITS[b]]);
  return out;
}

/** the 4 suited combos of two ranks */
const suitedCombos = (hi: string, lo: string): Combo[] => SUITS.map((s) => [hi + s, lo + s]);

/** the 12 offsuit combos of two ranks */
function offsuitCombos(hi: string, lo: string): Combo[] {
  const out: Combo[] = [];
  for (const s of SUITS) for (const t of SUITS) if (s !== t) out.push([hi + s, lo + t]);
  return out;
}

/** Every concrete two-card combo in a class: 6 for pairs, 4 suited, 12 offsuit. */
export function classCombos(i: number, j: number): Combo[] {
  if (i === j) return pairCombos(MATRIX_RANKS[i]!);
  const hi = MATRIX_RANKS[Math.min(i, j)]!;
  const lo = MATRIX_RANKS[Math.max(i, j)]!;
  return i < j ? suitedCombos(hi, lo) : offsuitCombos(hi, lo);
}

/** Combos of a class that do not collide with the cards on the board. */
export function liveCombos(i: number, j: number, board: readonly string[]): [string, string][] {
  const dead = new Set(board);
  return classCombos(i, j).filter(([a, b]) => !dead.has(a) && !dead.has(b));
}

/** Number of live combos across a painted range (169 booleans in matrix order). */
export function rangeComboCount(range: readonly boolean[], board: readonly string[]): number {
  let n = 0;
  for (let k = 0; k < 169; k++) {
    if (!range[k]) continue;
    const { i, j } = cellOf(k);
    n += liveCombos(i, j, board).length;
  }
  return n;
}

/* Presets, as sets of class labels. Broad strokes on purpose — these are a
   starting brush, not a solver's output. */
const P = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
export const RANGE_PRESETS: { key: string; label: string; classes: Set<string> }[] = [
  { key: "all", label: "any two", classes: new Set(Array.from({ length: 169 }, (_, k) => classLabel(cellOf(k).i, cellOf(k).j))) },
  { key: "pairs", label: "pairs", classes: P("AA KK QQ JJ TT 99 88 77 66 55 44 33 22") },
  { key: "top10", label: "top ~10%", classes: P("AA KK QQ JJ TT 99 88 AKs AQs AJs ATs KQs KJs QJs AKo AQo AJo KQo") },
  { key: "top25", label: "top ~25%", classes: P("AA KK QQ JJ TT 99 88 77 66 55 44 33 22 AKs AQs AJs ATs A9s A8s A7s A6s A5s A4s A3s A2s KQs KJs KTs K9s QJs QTs Q9s JTs J9s T9s 98s 87s 76s AKo AQo AJo ATo A9o KQo KJo KTo QJo QTo JTo") },
  { key: "suited", label: "suited", classes: new Set(Array.from({ length: 169 }, (_, k) => cellOf(k)).filter(({ i, j }) => i < j).map(({ i, j }) => classLabel(i, j))) },
];
