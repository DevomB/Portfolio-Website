import type { Metadata } from "next";
import { ButtonLink } from "@/app/(chrome)/Button";
import NotFoundTerminal from "@/app/NotFoundTerminal";

export const metadata: Metadata = {
  title: "404 — Not Found",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-lg">
        {/* terminal window */}
        <div className="rounded-xl border border-border overflow-hidden shadow-card">
          {/* chrome */}
          <div className="flex items-center gap-1.5 border-b border-border bg-surface px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-danger" />
            <span className="h-2.5 w-2.5 rounded-full bg-warn" />
            <span className="h-2.5 w-2.5 rounded-full bg-ok" />
            <span className="ml-3 font-mono text-[0.6rem] font-medium text-ink">bash — 80×24</span>
          </div>
          {/* terminal body — reads the missed path in the browser */}
          <NotFoundTerminal />
        </div>

        <div className="mt-6 flex items-center justify-center">
          <ButtonLink href="/">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Go home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
