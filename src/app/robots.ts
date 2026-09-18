import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/* Everything is public; the sitemap lists it. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
