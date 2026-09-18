import type { MetadataRoute } from "next";
import { projects } from "@/app/(home)/projects";
import { SITE_URL } from "@/lib/site";

/* Every public page, from the same project data the site renders: home, each
   project page, each project's demos, and the two legal pages. A new project
   or demo is listed without touching this file. */
export default function sitemap(): MetadataRoute.Sitemap {
  const demos = projects.flatMap((p) => [p.demoPath, ...(p.extraDemos ?? []).map((d) => d.path)]);
  const paths = [
    "/",
    ...projects.map((p) => `/projects/${p.slug}`),
    ...demos.filter((d): d is string => !!d),
    "/privacy",
    "/terms",
  ];
  return paths.map((path) => ({ url: new URL(path, SITE_URL).toString() }));
}
