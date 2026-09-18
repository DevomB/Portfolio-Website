import { getProject } from "@/app/(home)/projects";
import { ogCard } from "@/app/ogCard";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* one card per project; the alt text names it */
export function generateImageMetadata({ params }: { params: { slug: string } }) {
  const name = getProject(params.slug)?.name ?? params.slug;
  return [{ id: "card", alt: `${name} · Devom Brahmbhatt`, size, contentType }];
}

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return ogCard({ kicker: `// ${slug}`, title: [getProject(slug)?.name ?? slug], subtitle: "Devom Brahmbhatt" });
}
