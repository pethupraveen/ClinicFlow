import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only indexable public pages. Auth pages (/signup, /login, …) and /app are noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/demo`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
