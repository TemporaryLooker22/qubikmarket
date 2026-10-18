import "server-only";
import { db } from "./db";

// Avis entre membres (table MemberReview), affichés sur les profils /u/pseudo :
// - SELLER : un acheteur note un vendeur chez qui il a acheté ET téléchargé une ressource
// - BUYER : un vendeur note un client qui a téléchargé une de ses ressources
// Un seul avis par auteur, membre noté et rôle, modifiable ; le membre noté peut y répondre.

export type MemberRole = "SELLER" | "BUYER";
export const MEMBER_ROLES: MemberRole[] = ["SELLER", "BUYER"];

// Avis affichés : ceux dont l'auteur est banni sont masqués (et ne comptent pas dans les notes)
export const VISIBLE_MEMBER_REVIEW = { author: { bannedAt: null } };

// Signalements en attente (modération → Avis)
export const REPORTED_MEMBER_REVIEWS = { reports: { some: { dismissedAt: null } }, author: { bannedAt: null } };

// L'auteur peut-il noter ce membre dans ce rôle ? "download" : il y a un achat, mais rien n'a encore été téléchargé
export async function canMemberReview(authorId: string, targetId: string, role: MemberRole): Promise<"yes" | "download" | "no"> {
  if (authorId === targetId) return "no";
  // SELLER : l'auteur a acheté chez le membre noté ; BUYER : le membre noté a acheté chez l'auteur
  const [buyerId, sellerId] = role === "SELLER" ? [authorId, targetId] : [targetId, authorId];
  const purchases = await db.purchase.findMany({
    where: { userId: buyerId, status: "PAID", resource: { sellerId } },
    select: { lastDownloadedAt: true },
  });
  if (purchases.length === 0) return "no";
  return purchases.some((p) => p.lastDownloadedAt) ? "yes" : "download";
}

// Note moyenne reçue dans un rôle
export async function memberRating(targetId: string, role: MemberRole) {
  const { _avg, _count } = await db.memberReview.aggregate({ where: { targetId, role, ...VISIBLE_MEMBER_REVIEW }, _avg: { rating: true }, _count: true });
  return { rating: _count ? (_avg.rating ?? 0) : null, count: _count };
}

// Nombre d'achats payés entre deux membres (badge « A acheté 2 ressources » sous un avis vendeur)
export async function purchasesBetween(pairs: { buyerId: string; sellerId: string }[]) {
  if (pairs.length === 0) return new Map<string, number>();
  const rows = await db.purchase.groupBy({
    by: ["userId"],
    where: { status: "PAID", OR: pairs.map((p) => ({ userId: p.buyerId, resource: { sellerId: p.sellerId } })) },
    _count: true,
  });
  return new Map(rows.map((r) => [r.userId, r._count]));
}
