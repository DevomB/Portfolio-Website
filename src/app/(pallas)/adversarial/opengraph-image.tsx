import { ogCard } from "@/app/ogCard";

export const alt = "Adversarial Tape · Devom Brahmbhatt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogCard({ kicker: "// adversarial", title: ["Adversarial Tape"], subtitle: "Devom Brahmbhatt" });
}
