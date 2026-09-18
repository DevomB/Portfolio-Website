import type { Metadata } from "next";
import PageWrapper from "@/app/(home)/PageWrapper";
import { pageMetadata } from "@/app/(chrome)/pageMetadata";
import { PROFILES, SITE_NAME, SITE_URL } from "@/lib/site";
import Navbar from "@/app/(chrome)/Navbar";
import HeroSection from "@/app/(home)/HeroSection";
import AboutSection from "@/app/(home)/AboutSection";
import ProjectsSection from "@/app/(home)/ProjectsSection";
import TectonixSection from "@/app/(home)/TectonixSection";
import SideQuestsSection from "@/app/(home)/SideQuestsSection";
import Footer from "@/app/(chrome)/Footer";

export const metadata: Metadata = pageMetadata({
  description:
    "Devom Brahmbhatt builds trading and backtesting engines, pricing and poker math, and deterministic runtimes, each running live here as the real code.",
  path: "/",
});

/* Who the site is about, for search engines: the name, the site, and the
   same public profiles the footer links. Nothing else. */
const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: SITE_NAME,
  url: SITE_URL,
  sameAs: PROFILES.map((p) => p.href),
};

export default function Home() {
  return (
    <PageWrapper>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(person).replace(/</g, "\\u003c") }}
      />
      <Navbar />
      <main className="min-h-screen">
        <div className="page-shell">
          <HeroSection />
          <AboutSection />
          <ProjectsSection />
          <TectonixSection />
          <SideQuestsSection />
        </div>
        <Footer />
      </main>
    </PageWrapper>
  );
}
