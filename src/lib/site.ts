/* The site's identity, in one place: the metadata, the sitemap, robots.txt
   and the home page's JSON-LD all read from here. */

/** Absolute origin. metadataBase turns every relative metadata URL into this. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devomb.com";

export const SITE_NAME = "Devom Brahmbhatt";

/** The default title, in step with the hero H1. */
export const SITE_TITLE = "Devom Brahmbhatt — Trader · Engineer · Researcher";

/** Public profiles, as the footer lists them. */
export const PROFILES = [
  { label: "GitHub", href: "https://github.com/DevomB" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/devomb/" },
  { label: "NPM", href: "https://www.npmjs.com/~devomb" },
  { label: "Crates", href: "https://crates.io/users/DevomB" },
] as const;
