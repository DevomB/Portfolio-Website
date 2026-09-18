import { ogCard } from "@/app/ogCard";

export const alt = "Poker Equity Calculator · Devom Brahmbhatt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogCard({ kicker: "// poker-lab", title: ["Poker Equity Calculator"], subtitle: "Devom Brahmbhatt" });
}
