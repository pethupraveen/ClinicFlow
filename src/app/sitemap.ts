import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only indexable public pages. /demo and /signup join once they are real pages.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
