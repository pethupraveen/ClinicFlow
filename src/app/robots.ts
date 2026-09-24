import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated app, platform admin and APIs are never indexed.
      disallow: ["/app/", "/platform/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
