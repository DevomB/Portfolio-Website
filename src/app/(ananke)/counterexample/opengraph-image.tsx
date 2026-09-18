import { ogCard } from "@/app/ogCard";

export const alt = "Counterexample · Devom Brahmbhatt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogCard({ kicker: "// counterexample", title: ["Counterexample"], subtitle: "Devom Brahmbhatt" });
}
