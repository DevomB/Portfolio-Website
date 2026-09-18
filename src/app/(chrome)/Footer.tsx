import Link from "next/link";
import IntentLink from "@/app/(chrome)/IntentLink";
import { PROFILES } from "@/lib/site";

// the public profiles (shared with the home page's JSON-LD), then the legal pages
const links = [
  ...PROFILES.map((p) => ({ ...p, external: true })),
  { label: "Privacy", href: "/privacy", external: false },
  { label: "Terms", href: "/terms", external: false },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t bg-bg" style={{ borderColor: "rgb(var(--brand-purple-rgb) / 0.22)" }}>
      {/* centered link row, copyright on its own line beneath */}
      <div className="mx-auto w-[min(100%-2*var(--shell-inline),76rem)] px-[var(--shell-inline)] pt-8 pb-1">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {links.map((l) =>
            l.external ? (
              <Link
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-fluid-xs text-muted transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            ) : (
              /* privacy and terms are rarely the next click: warm on hover, not on scroll */
              <IntentLink
                key={l.href}
                href={l.href}
                className="font-mono text-fluid-xs text-muted transition-colors hover:text-ink"
              >
                {l.label}
              </IntentLink>
            ),
          )}
        </div>
        <p className="mt-5 text-center font-mono text-fluid-xs text-muted">
          © {year} Devom Brahmbhatt
        </p>
      </div>

      <div className="select-none overflow-hidden" style={{ marginTop: "-5px" }} aria-hidden>
        <p
          className="text-center font-wordmark leading-none whitespace-nowrap"
          style={{
            /* Anybody at 125% width is 1.32x wider than Bricolage for DEVOM,
               so 16.8vw -> 12.7vw keeps the same span across the footer. */
            fontSize: "clamp(2.1rem, 12.7vw, 15.7rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            fontVariationSettings: '"wdth" 125',
            color: "var(--color-accent-dim)",
            paddingInline: "var(--shell-inline)",
          }}
        >
          DEVOM
        </p>
      </div>

      {/* tiny bottom strip so page doesn't end abruptly */}
      <div className="h-3 bg-bg" />
    </footer>
  );
}
