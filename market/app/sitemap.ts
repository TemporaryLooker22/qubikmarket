import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalog";
import { SITE_URL } from "@/lib/site";

// Rafraîchi au plus toutes les heures
export const revalidate = 3600;

// sitemap.xml : la liste des pages à indexer, envoyée à Google (Search Console)
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [resources, sellers] = await Promise.all([
    db.resource.findMany({ where: { status: "APPROVED" }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" } }),
    // Profils des vendeurs qui ont au moins une ressource en ligne
    db.user.findMany({ where: { bannedAt: null, resources: { some: { status: "APPROVED" } } }, select: { username: true, createdAt: true } }),
  ]);
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/resources`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...CATEGORIES.map((c) => ({ url: `${SITE_URL}/resources?category=${c.id}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...resources.map((r) => ({ url: `${SITE_URL}/resources/${r.slug}`, lastModified: r.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...sellers.map((u) => ({ url: `${SITE_URL}/u/${encodeURIComponent(u.username)}`, lastModified: u.createdAt, changeFrequency: "weekly" as const, priority: 0.5 })),
    { url: `${SITE_URL}/become-seller`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
