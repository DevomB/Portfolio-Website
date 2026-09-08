import Link from "next/link";
import type { ReactNode } from "react";
import Navbar from "@/app/(chrome)/Navbar";

/* The shell every in-browser demo shares: the chrome, the way back to its
   project, a // kicker, a title, a lede, then the demo itself. Seven pages
   used to carry this markup each; a demo page is now its metadata, its lede,
   and its component. */

/** The arrow link at the top of demo and legal pages. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 font-mono text-fluid-xs text-muted transition-colors hover:text-ink mb-8"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
      </svg>
      {children}
    </Link>
  );
}

/** A link to the engine behind a demo, inside its lede. */
export function LedeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-dim transition-colors">
      {children}
    </a>
  );
}

export default function DemoPage({
  back,
  kicker,
  title,
  lede,
  wide = true,
  children,
}: {
  /** the project page this demo belongs to */
  back: string;
  /** the // label above the title, e.g. "poker-lab" */
  kicker: string;
  title: string;
  lede: ReactNode;
  /** ledes run to max-w-2xl; a short one reads better at max-w-xl */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="page-shell">
          <BackLink href={back}>back to project</BackLink>

          <div className="mb-8">
            <p className="font-mono text-fluid-xs text-secondary tracking-wide mb-2">{`// ${kicker}`}</p>
            <h1 className="font-title text-fluid-4xl font-bold tracking-tight text-ink">{title}</h1>
            <p className={`mt-2 text-fluid-base text-muted ${wide ? "max-w-2xl" : "max-w-xl"}`}>{lede}</p>
          </div>

          {children}
        </div>
      </main>
    </>
  );
}
