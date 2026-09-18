import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { projects, getProject, type Project } from "@/app/(home)/projects";
import Navbar from "@/app/(chrome)/Navbar";
import Footer from "@/app/(chrome)/Footer";
import { ButtonLink } from "@/app/(chrome)/Button";
import CopyButton from "@/app/(home)/CopyButton";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

/** Where the project is published, in the order its buttons appear. */
function registryLinks(p: Project): { label: string; href: string }[] {
  return [
    p.npmPackage && { label: "npm", href: `https://www.npmjs.com/package/${p.npmPackage}` },
    p.crate && { label: "crates.io", href: `https://crates.io/crates/${p.crate}` },
    p.pypiPackage && { label: "PyPI", href: `https://pypi.org/project/${p.pypiPackage}/` },
  ].filter((r): r is { label: string; href: string } => !!r);
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z" />
    </svg>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return {
    title: project.name,
    description: project.tagline,
  };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="page-shell">
          {/* back link */}
          <Link
            href="/#projects"
            className="inline-flex items-center gap-1.5 font-mono text-fluid-xs text-muted transition-colors hover:text-ink mb-8"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            back to projects
          </Link>

          {/* header */}
          <div className="mb-8">
            <p className="font-mono text-fluid-xs text-secondary tracking-wide mb-2">
              {`// ${project.slug}`}
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="font-title text-fluid-4xl font-bold tracking-tight text-ink">
                  {project.name}
                </h1>
                <p className="mt-2 text-fluid-lg text-muted max-w-xl">
                  {project.tagline}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {project.techStack.map((t) => (
                  <span key={t} className="chip-soft px-3 py-1.5 font-mono text-fluid-xs">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* action row, the same order on every project: the live demo, the
              other demos, the source, the registry. Demo routes are whole
              interactive desks — fetched on intent, not for every reader. */}
          <div className="mb-10 flex flex-wrap gap-3 items-center">
            {project.demoPath && (
              <ButtonLink href={project.demoPath} prefetch="intent">
                <PlayIcon />
                Open live demo
              </ButtonLink>
            )}
            {project.extraDemos?.map((d) => (
              <ButtonLink key={d.path} href={d.path} prefetch="intent" variant="ghost">
                <PlayIcon />
                {d.label}
              </ButtonLink>
            ))}
            {project.liveUrl && (
              <ButtonLink href={project.liveUrl} variant="ghost">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Live site
              </ButtonLink>
            )}
            {project.githubUrl && (
              <ButtonLink href={project.githubUrl} variant="ghost">
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                View source
              </ButtonLink>
            )}
            {registryLinks(project).map((r) => (
              <ButtonLink key={r.href} href={r.href} variant="ghost">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
                {r.label}
              </ButtonLink>
            ))}
          </div>

          {/* npm snippet */}
          {project.npmPackage && (
            <div className="mb-10 rounded-xl border border-accent/20 bg-code-bg overflow-hidden">
              <div className="flex items-center justify-between border-b border-accent/10 px-4 py-2.5">
                <span className="font-mono text-fluid-xs text-accent/70">npm</span>
                <CopyButton text={`npm install ${project.npmPackage}`} />
              </div>
              <pre className="px-4 py-3 font-mono text-fluid-xs text-ink overflow-x-auto">
                <span className="text-muted">$ </span>npm install {project.npmPackage}
              </pre>
            </div>
          )}

          {/* pip snippet */}
          {project.pypiPackage && (
            <div className="mb-10 rounded-xl border border-accent/20 bg-code-bg overflow-hidden">
              <div className="flex items-center justify-between border-b border-accent/10 px-4 py-2.5">
                <span className="font-mono text-fluid-xs text-accent/70">pip</span>
                <CopyButton text={`pip install ${project.pypiPackage}`} />
              </div>
              <pre className="px-4 py-3 font-mono text-fluid-xs text-ink overflow-x-auto">
                <span className="text-muted">$ </span>pip install {project.pypiPackage}
              </pre>
            </div>
          )}

          {/* description */}
          <div className="mb-10 max-w-2xl">
            <p className="text-fluid-base leading-relaxed text-muted">{project.description}</p>
          </div>

          {/* readme sections */}
          {project.readmeSections && project.readmeSections.length > 0 && (
            <div className="space-y-8 max-w-2xl">
              {project.readmeSections.map((s) => (
                <div key={s.title}>
                  <h2 className="font-title text-fluid-xl font-semibold text-ink mb-3">{s.title}</h2>
                  <p className="text-fluid-base leading-relaxed text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <Footer />
      </main>
    </>
  );
}
