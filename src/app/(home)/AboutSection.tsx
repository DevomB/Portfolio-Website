"use client";

import { m } from "framer-motion";
import { fade } from "@/app/(home)/fade";

const stack = [
  { slug: "postgresql",  label: "PostgreSQL" },
  { slug: "nodedotjs",   label: "Node.js" },
  { slug: "typescript",  label: "TypeScript" },
  { slug: "cplusplus",   label: "C++20" },
  { slug: "nextdotjs",   label: "Next.js" },
  { slug: "flutter",     label: "Flutter" },
  { slug: "redis",       label: "Redis" },
];

export default function AboutSection() {
  return (
    <section id="about" className="scroll-mt-28 section-y">
      <m.p {...fade(0)} className="font-mono text-fluid-xs text-secondary tracking-wide mb-10">
        {"// about"}
      </m.p>

      <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
        <m.div {...fade(0.05)}>
          <div className="space-y-4 text-fluid-base leading-relaxed text-muted">
            <p>
              Based in Eastvale, California. I design and build backends for
              production systems — PostgreSQL schemas, API layers, and parallel
              C++ simulation engines.
            </p>
            <p>
              Lately: an event-driven backtesting engine in Rust, a deterministic
              event runtime in OCaml, a Go engine that plays, and poker math shipped
              as an npm package with a C++ core. Everything demoed on this site runs
              the real thing — nothing is ported to make it fit.
            </p>
          </div>
        </m.div>

        <m.div {...fade(0.1)}>
          <p className="mb-4 font-mono text-fluid-xs text-muted uppercase tracking-widest">Stack</p>
          <div className="flex flex-wrap gap-x-5 gap-y-4">
            {stack.map((s) => (
              <div key={s.slug} className="flex flex-col items-center gap-1.5">
                {/* self-hosted (public/icons, CC0 from simpleicons) — no third-party
                    request per visitor, and coloured in the live palette; the CDN URL
                    still carried the retired cream-palette ink, near-black on black.
                    Plain <img>: these are 22px inline SVGs, nothing for next/image to do. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/icons/${s.slug}.svg`}
                  alt={s.label}
                  width={22}
                  height={22}
                  loading="lazy"
                  decoding="async"
                  style={{ opacity: 0.7 }}
                />
                <span className="font-mono text-fluid-xs text-muted">{s.label}</span>
              </div>
            ))}
          </div>
        </m.div>
      </div>
    </section>
  );
}
