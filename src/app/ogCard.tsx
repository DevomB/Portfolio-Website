import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { FanMark } from "@/app/mark";

/* The link-preview card, shared by the root and every project and demo page:
   the fan mark (from mark.tsx — never redrawn), a // kicker, the title, one
   line under it, and the devomb.com strip. Only the words change per page. */

/* Brand palette — mirrors globals.css; the renderer cannot read CSS variables. */
const BG = "#000000";
const INK = "#f2eefa";
const MUTED = "#9a8fb0";
const PURPLE = "#7c00ff";
const PURPLE_DIM = "#a35cff";
const GREEN = "#09ff00";

const SIZE = { width: 1200, height: 630 };
const TITLE_WIDTH = 648; // the column beside the mark: 1200 − 2×104 padding − 272 mark − 72 gap

/** Bricolage 800 advances about 0.58em a character: the largest title size, up
 *  to the root card's 96px, at which the title's longest word keeps its line. */
function titleSize(title: string[]) {
  const longest = Math.max(...title.flatMap((line) => line.split(" ")).map((w) => w.length));
  return Math.min(96, Math.floor(TITLE_WIDTH / (longest * 0.58)));
}

async function font(file: string) {
  return readFile(join(process.cwd(), "src/brand/fonts", file));
}

export async function ogCard({ kicker, title, subtitle }: {
  /** the // label above the title, e.g. "// landscape" */
  kicker: string;
  /** the title, a line per entry; a long entry wraps */
  title: string[];
  /** the line under the title */
  subtitle: string;
}) {
  const [bricolage, geistMono] = await Promise.all([
    font("bricolage-800.woff"),
    font("geistmono-500.woff"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BG,
          position: "relative",
          fontFamily: "Bricolage",
        }}
      >
        {/* purple glow behind the mark */}
        <div
          style={{
            position: "absolute",
            left: -120,
            top: -80,
            width: 760,
            height: 790,
            background:
              "radial-gradient(circle at 50% 50%, rgba(124,0,255,0.42) 0%, rgba(124,0,255,0.14) 32%, rgba(124,0,255,0) 62%)",
          }}
        />
        {/* faint green pin-light bottom right — the pip's colour, kept quiet */}
        <div
          style={{
            position: "absolute",
            right: -200,
            bottom: -260,
            width: 620,
            height: 620,
            background:
              "radial-gradient(circle at 50% 50%, rgba(9,255,0,0.10) 0%, rgba(9,255,0,0) 60%)",
          }}
        />

        {/* card frame */}
        <div
          style={{
            position: "absolute",
            left: 36,
            top: 36,
            right: 36,
            bottom: 36,
            border: "1.5px solid rgba(124,0,255,0.34)",
            borderRadius: 28,
          }}
        />

        {/* content */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            height: "100%",
            padding: "0 104px",
            gap: 72,
          }}
        >
          <div style={{ display: "flex", flexShrink: 0 }}>
            <FanMark size={272} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
            <div
              style={{
                display: "flex",
                fontFamily: "GeistMono",
                fontSize: 24,
                color: GREEN,
                letterSpacing: "0.02em",
                marginBottom: 22,
              }}
            >
              {kicker}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: TITLE_WIDTH,
                fontSize: titleSize(title),
                fontWeight: 800,
                lineHeight: 0.92,
                letterSpacing: "-0.035em",
                color: INK,
              }}
            >
              {title.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 30,
                fontFamily: "GeistMono",
                fontSize: 30,
                color: PURPLE_DIM,
                letterSpacing: "-0.01em",
              }}
            >
              {subtitle}
            </div>
          </div>
        </div>

        {/* footer strip: url + pip */}
        <div
          style={{
            position: "absolute",
            left: 104,
            bottom: 66,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: "GeistMono",
            fontSize: 24,
            color: MUTED,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              background: GREEN,
              transform: "rotate(45deg)",
            }}
          />
          <div style={{ display: "flex" }}>
            devomb<span style={{ color: PURPLE }}>.</span>com
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [
        { name: "Bricolage", data: bricolage, weight: 800, style: "normal" },
        { name: "GeistMono", data: geistMono, weight: 500, style: "normal" },
      ],
    },
  );
}
