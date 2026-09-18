import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Anybody,
  Bricolage_Grotesque,
  Geist_Mono,
  IBM_Plex_Sans,
  Space_Grotesk,
} from "next/font/google";
import MotionProvider from "@/app/(chrome)/MotionProvider";
import { SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

/* The type system, one family per role. Decided in the font lab, 2026-09-03.
   Roles are exposed to Tailwind as font-sans / font-display / font-title /
   font-mono / font-wordmark — see tailwind.config.js. */

/* body copy, row names, taglines — the default */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

/* the hero, the splash, and small UI chrome (nav links, buttons, pills) */
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

/* page titles on project, demo, and legal pages — never on the home page,
   so it is not preloaded: with preload on, every home visitor downloaded
   ~22KB of a face no element there uses. It still self-hosts and loads on
   first use; the metric-matched fallback keeps the swap from shifting layout. */
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-title",
  display: "swap",
  preload: false,
});

/* everything machine-facing: // labels, dates, numerals, code, terminals */
const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

/* the footer wordmark only — run wide via its width axis */
const anybody = Anybody({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-wordmark",
  display: "swap",
});

/* metadataBase is what turns the opengraph-image / twitter-image / apple-icon
   file conventions — and every page's canonical path — into absolute URLs in
   the <head>. Without it, previews on iMessage, LinkedIn, and X get a relative
   path and render a blank card.

   The default title is the hero's line; a page's own title is templated
   under the name. Each page sets its description, canonical URL and preview
   fields through pageMetadata() in (chrome); these are the fallbacks. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  openGraph: {
    title: SITE_TITLE,
    type: "website",
    locale: "en_US",
    siteName: "devomb.com",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${plexSans.variable} ${bricolage.variable} ${spaceGrotesk.variable} ${mono.variable} ${anybody.variable} font-sans antialiased`}
      >
        <MotionProvider>{children}</MotionProvider>
        <Analytics />
      </body>
    </html>
  );
}
