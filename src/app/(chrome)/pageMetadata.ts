import type { Metadata } from "next";
import { SITE_NAME, SITE_TITLE } from "@/lib/site";

/** One page's metadata: its title (the layout templates it as
 *  "%s · Devom Brahmbhatt"), its description, and its canonical path — plus
 *  the Open Graph and Twitter fields a link preview reads, which Next does not
 *  template or inherit per page. The preview image comes from the page's own
 *  opengraph-image file where it has one. */
export function pageMetadata({ title, description, path }: { title?: string; description: string; path: string }): Metadata {
  const full = title ? `${title} · ${SITE_NAME}` : SITE_TITLE;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: { title: full, description, url: path, type: "website", locale: "en_US", siteName: "devomb.com" },
    twitter: { card: "summary_large_image", title: full, description },
  };
}
