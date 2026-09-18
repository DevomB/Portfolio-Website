import type { Metadata } from "next";
import PageWrapper from "@/app/(home)/PageWrapper";
import { pageMetadata } from "@/app/(chrome)/pageMetadata";
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

export default function Home() {
  return (
    <PageWrapper>
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
