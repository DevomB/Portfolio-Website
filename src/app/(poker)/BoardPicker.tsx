"use client";

import { MATRIX_RANKS } from "@/app/(poker)/handMatrix";

/* Board editor shared by the poker surfaces: five slots, a random deal, and a
   52-card picker. `streets` deals a flop first and then one card at a time;
   `river` fills the board to five in one go. */

export const SUIT_GLYPH: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
export const SUIT_RED = new Set(["h", "d"]);
const ALL_CARDS = MATRIX_RANKS.split("").flatMap((r) => ["s", "h", "d", "c"].map((s) => r + s));

type Props = {
  board: string[];
  onChange: (board: string[]) => void;
  variant: "streets" | "river";
};

export default function BoardPicker({ board, onChange, variant }: Props) {
  const n = board.length;
  const inBoard = (c: string) => board.includes(c);
  const deal = (c: string) => {
    if (inBoard(c) || n >= 5) return;
    onChange([...board, c]);
  };
  const dealRandom = (count: number) => {
    const free = ALL_CARDS.filter((c) => !inBoard(c));
    const picks: string[] = [];
    while (picks.length < count && free.length) picks.push(free.splice(Math.floor(Math.random() * free.length), 1)[0]!);
    onChange([...board, ...picks].slice(0, 5));
  };

  const dealCount = variant === "river" ? 5 - n : n < 3 ? 3 - n : 1;
  const dealLabel = n >= 5 ? "full"
    : variant === "river" ? (n === 0 ? "deal a river" : `deal ${5 - n} more`)
    : n < 3 ? "deal flop" : n === 3 ? "turn" : "river";
  const hint = n >= 5 ? null
    : variant === "river" ? `${5 - n} more card${5 - n > 1 ? "s" : ""} to price the river`
    : n > 0 && n < 3 ? `pick ${3 - n} more for the flop` : null;

  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-fluid-xs text-muted">board</p>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => dealRandom(dealCount)} disabled={n >= 5}
                  className="chip-soft px-2.5 py-1 font-mono text-[0.62rem] text-ink disabled:opacity-40 hover:border-accent/40 transition-colors">
            {dealLabel}
          </button>
          <button type="button" onClick={() => onChange([])} disabled={n === 0}
                  className="chip-soft px-2.5 py-1 font-mono text-[0.62rem] text-muted disabled:opacity-40 hover:text-ink transition-colors">
            clear
          </button>
        </div>
      </div>
      <div className="mt-3 flex gap-1.5 min-h-[3.2rem]">
        {Array.from({ length: 5 }, (_, i) => board[i]).map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => c && onChange(board.filter((x) => x !== c))}
            title={c ? "remove" : undefined}
            className={`h-12 w-9 rounded-md border font-mono text-sm font-bold ${c ? "border-card-edge bg-white" : "border-dashed border-accent/20 bg-accent/5"}`}
            style={{ color: c && SUIT_RED.has(c[1]!) ? "var(--color-card-red)" : "var(--color-card-black)" }}
          >
            {c ? <>{c[0] === "T" ? "10" : c[0]}<span className="block text-[0.7rem] leading-none">{SUIT_GLYPH[c[1]!]}</span></> : null}
          </button>
        ))}
      </div>
      {hint && <p className="mt-2 font-mono text-[0.6rem] text-muted">{hint}</p>}
      {/* picker: each suit's thirteen ranks share one row at every width */}
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
        {(["s", "h", "d", "c"] as const).map((s) => (
          <div key={s} className="contents">
            <span className="font-mono text-[0.7rem]" style={{ color: SUIT_RED.has(s) ? "var(--color-card-red)" : "var(--color-ink)" }}>{SUIT_GLYPH[s]}</span>
            <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-[2px]">
              {MATRIX_RANKS.split("").map((r) => {
                const c = r + s; const used = inBoard(c);
                return (
                  <button key={c} type="button" onClick={() => deal(c)} disabled={used || n >= 5}
                          className={`h-5 min-w-0 rounded-sm font-mono text-[0.6rem] transition-colors ${used ? "bg-accent/30 text-ink/40" : "bg-surface-elevated text-muted hover:text-ink hover:bg-accent-bg"} disabled:cursor-default`}>
                    {r}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
