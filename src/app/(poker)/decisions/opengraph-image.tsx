import { ogCard } from "@/app/ogCard";

export const alt = "Geometry of Decisions · Devom Brahmbhatt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogCard({ kicker: "// decisions", title: ["Geometry of Decisions"], subtitle: "Devom Brahmbhatt" });
}
