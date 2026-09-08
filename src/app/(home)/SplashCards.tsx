/* The two faces of a splash card. Pure presentation: the ring, the timeline
   and the deal live in Splash.tsx. */

const RANKS = "23456789TJQKA";
const SUITS = ["♣", "♦", "♥", "♠"];
const isRed = (suit: number) => suit === 1 || suit === 2;

export function CardBack() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 6,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        border: "1px solid rgb(var(--brand-purple-rgb) / 0.5)",
        background: `
          repeating-linear-gradient(45deg, rgb(var(--brand-purple-rgb) / 0.28) 0 2px, transparent 2px 5px),
          repeating-linear-gradient(-45deg, rgb(var(--brand-purple-rgb) / 0.28) 0 2px, transparent 2px 5px),
          linear-gradient(155deg, var(--color-surface-elevated) 0%, var(--color-surface) 100%)
        `,
        boxShadow:
          "inset 0 0 0 3px rgb(var(--brand-black-rgb) / 0.62), inset 0 0 0 4px rgb(var(--brand-purple-rgb) / 0.3), 0 2px 8px rgb(var(--brand-black-rgb) / 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          width: 11,
          height: 11,
          transform: "rotate(45deg)",
          border: "1px solid rgb(var(--brand-green-rgb) / 0.55)",
          background: "rgb(var(--brand-green-rgb) / 0.1)",
        }}
      />
    </div>
  );
}

export function CardFace({ rank, suit }: { rank: number; suit: number }) {
  const color = isRed(suit) ? "var(--color-card-red)" : "var(--color-card-black)";
  const glyph = SUITS[suit];
  const label = RANKS[rank - 2];

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 6,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: "rotateY(180deg)",
        background: "linear-gradient(160deg, var(--color-card-face) 0%, var(--color-card-face-2) 100%)",
        border: "1px solid var(--color-card-edge)",
        boxShadow:
          "0 4px 14px rgb(var(--brand-black-rgb) / 0.75), 0 0 0 2px rgb(var(--brand-purple-rgb) / 0.28)",
      }}
    >
      <div style={{ position: "absolute", top: 4, left: 5, color, lineHeight: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, fontFamily: "var(--font-mono), monospace" }}>{label}</div>
        <div style={{ fontSize: 8, marginTop: 1 }}>{glyph}</div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          fontSize: 24,
        }}
      >
        {glyph}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 4,
          right: 5,
          color,
          lineHeight: 1,
          transform: "rotate(180deg)",
          fontFamily: "var(--font-mono), monospace",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: 8, marginTop: 1 }}>{glyph}</div>
      </div>
    </div>
  );
}
