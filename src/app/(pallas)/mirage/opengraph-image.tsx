import { ogCard } from "@/app/ogCard";

export const alt = "The Mirage · Devom Brahmbhatt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return ogCard({ kicker: "// mirage", title: ["The Mirage"], subtitle: "Devom Brahmbhatt" });
}
