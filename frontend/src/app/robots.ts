import { MetadataRoute } from "next";
import { siteConfig } from "@/config/site.config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/register"],
      disallow: ["/dashboard", "/api", "/_next"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
