import "server-only";
import { db } from "@/lib/db";
import { isOnline, responseTime } from "@/lib/chat";
import type { AboutResource } from "./Thread";

// Données communes aux pages d'une conversation : l'autre membre et la ressource dont on veut parler

export async function otherMember(id: string) {
  const [user, resources, response] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { id: true, username: true, lastSeenAt: true, avatarUrl: true } }),
    db.resource.count({ where: { sellerId: id, status: "APPROVED" } }),
    responseTime(id),
  ]);
  return user ? { id: user.id, username: user.username, avatarUrl: user.avatarUrl, online: isOnline(user.lastSeenAt), response, resources } : null;
}

// Ressource en ligne de l'un des deux membres (sinon on n'affiche pas de carte « À propos de »)
export async function aboutResource(resourceId: string | undefined, memberIds: string[]): Promise<AboutResource | null> {
  if (!resourceId) return null;
  const r = await db.resource.findFirst({
    where: { id: resourceId, status: "APPROVED", sellerId: { in: memberIds } },
    select: { id: true, slug: true, title: true, images: true, priceCents: true, category: true },
  });
  return r ? { id: r.id, slug: r.slug, title: r.title, image: r.images[0] ?? null, priceCents: r.priceCents, category: r.category } : null;
}
