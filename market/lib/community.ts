import "server-only";
import { db } from "@/lib/db";

// Chiffres de la communauté affichés sous la recherche de l'accueil (et rafraîchis en direct, voir /api/community) :
// membres (non bannis), vendeurs avec au moins une ressource en ligne, gains des vendeurs (ventes non annulées)
export async function communityCounts() {
  const [members, sellers, earned] = await Promise.all([
    db.user.count({ where: { bannedAt: null } }),
    db.user.count({ where: { bannedAt: null, resources: { some: { status: "APPROVED" } } } }),
    db.sellerEarning.aggregate({ where: { purchaseId: { not: null }, status: { not: "CANCELED" } }, _sum: { amountCents: true } }),
  ]);
  return { members, sellers, earnedCents: earned._sum.amountCents ?? 0 };
}
