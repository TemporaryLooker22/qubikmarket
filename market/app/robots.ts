import type { MetadataRoute } from "next";
import { DEMO_ENABLED } from "@/lib/demo";
import { SITE_URL } from "@/lib/site";

// robots.txt : Google peut parcourir les pages publiques, pas les espaces privés ni l'API
export default function robots(): MetadataRoute.Robots {
  if (DEMO_ENABLED) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/dashboard", "/messages", "/checkout", "/sell"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
