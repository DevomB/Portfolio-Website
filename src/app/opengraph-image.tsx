import { ogCard } from "@/app/ogCard";

export const alt = "Devom Brahmbhatt — Trader · Engineer · Researcher";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogCard({ kicker: "// portfolio", title: ["Devom", "Brahmbhatt"], subtitle: "Trader · Engineer · Researcher" });
}
