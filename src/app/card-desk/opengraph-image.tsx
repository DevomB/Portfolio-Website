import { ogCard } from "@/app/ogCard";

export const alt = "Card Sum Options Desk · Devom Brahmbhatt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogCard({ kicker: "// card-desk", title: ["Card Sum Options Desk"], subtitle: "Devom Brahmbhatt" });
}
