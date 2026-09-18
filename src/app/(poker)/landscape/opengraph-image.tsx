import { ogCard } from "@/app/ogCard";

export const alt = "The Landscape · Devom Brahmbhatt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogCard({ kicker: "// landscape", title: ["The Landscape"], subtitle: "Devom Brahmbhatt" });
}
