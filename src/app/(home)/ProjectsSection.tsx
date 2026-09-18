"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { fade } from "@/app/(home)/fade";
import { projects } from "@/app/(home)/projects";

export default function ProjectsSection() {
  return (
    <section id="projects" className="scroll-mt-28 section-y">
      <m.p {...fade(0)} className="font-mono text-fluid-xs text-secondary tracking-wide mb-10">
        {"// projects"}
      </m.p>

      <div>
        {projects.map((p, i) => (
          <m.div key={p.slug} {...fade(i * 0.06)}>
            {i > 0 && <div className="w-full h-px" style={{ background: "var(--color-border)" }} aria-hidden />}
            <Link
              href={`/projects/${p.slug}`}
              className="group flex gap-5 py-7 transition-opacity hover:opacity-70"
            >
              <span
                className="shrink-0 font-mono tabular-nums select-none pt-px"
                style={{ fontSize: "0.65rem", color: "var(--color-accent)", opacity: 0.55, minWidth: "2ch" }}
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
                  <p className="font-semibold text-fluid-sm text-ink">{p.name}</p>
                  {/* a tag, not a second link: the whole row goes to the project page */}
                  {(p.demoPath || p.liveUrl) && (
                    <span className="font-mono text-fluid-xs text-accent-dim shrink-0">
                      {p.demoPath ? "live demo" : "site"}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-fluid-sm leading-relaxed text-muted">{p.tagline}</p>
                <p className="mt-2.5 font-mono text-fluid-xs text-muted/60">
                  {p.techStack.slice(0, 4).join(" · ")}{p.techStack.length > 4 ? ` · +${p.techStack.length - 4}` : ""}
                </p>
              </div>
            </Link>
          </m.div>
        ))}
        <div className="w-full h-px" style={{ background: "var(--color-border)" }} aria-hidden />
      </div>
    </section>
  );
}
