import type { Metadata } from "next";
import { SITE_NAME, SITE_TITLE } from "@/lib/site";

/** One page's metadata: its title (the layout templates it as
 *  "%s · Devom Brahmbhatt"), its description, and its canonical path — plus
 *  the Open Graph and Twitter fields a link preview reads, which Next does not
 *  template or inherit per page.
 *
 *  The preview card: a page-level openGraph replaces the layout's wholesale,
 *  the site card included. A page with its own opengraph-image and
 *  twitter-image files (`ownCard`) gets those, as long as no image is named
 *  here; any other page names the site card explicitly. */
export function pageMetadata({ title, description, path, ownCard = false }: {
  title?: string;
  description: string;
  path: string;
  ownCard?: boolean;
}): Metadata {
  const full = title ? `${title} · ${SITE_NAME}` : SITE_TITLE;
  const card = (url: string) => (ownCard ? {} : { images: [{ url, width: 1200, height: 630, alt: SITE_TITLE }] });
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { title: full, description, url: path, type: "website", locale: "en_US", siteName: "devomb.com", ...card("/opengraph-image") },
    twitter: { card: "summary_large_image", title: full, description, ...card("/twitter-image") },
  };
}
