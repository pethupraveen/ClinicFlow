import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only indexable public pages. /signup joins once it is a real page.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/demo`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
