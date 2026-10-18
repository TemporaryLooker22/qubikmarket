import "server-only";
import { db } from "./db";

// Avis des acheteurs (table Review).
// Seuls ceux qui ont acheté (ou obtenu gratuitement) ET téléchargé une ressource peuvent laisser un avis.
// La note moyenne de chaque ressource est gardée sur la ressource elle-même (ratingAvg, ratingCount, ratingScore)
// pour afficher les cartes du catalogue et trier par « Mieux notées » sans tout recalculer.

export const REVIEW_MAX = 1000; // longueur maximale d'un avis et d'une réponse du vendeur
export const REVIEWS_SHOWN = 3; // avis affichés avant « Voir les autres avis »

// Tri « Mieux notées » : la moyenne est tirée vers 3,5 tant qu'il y a peu d'avis,
// pour qu'une seule note de 5 ne passe pas devant une ressource notée 4,8 sur 40 avis
const PRIOR_COUNT = 3;
const PRIOR_MEAN = 3.5;

// L'utilisateur peut-il donner son avis ? (achat payé ou obtenu gratuitement, puis téléchargé)
export async function canReview(userId: string, resourceId: string) {
  const purchase = await db.purchase.findUnique({
    where: { userId_resourceId: { userId, resourceId } },
    select: { status: true, lastDownloadedAt: true },
  });
  if (!purchase || purchase.status !== "PAID") return "no" as const;
  return purchase.lastDownloadedAt ? ("yes" as const) : ("download" as const);
}

// Recalcule la note d'une ressource après un avis ajouté, modifié ou supprimé
export async function refreshRating(resourceId: string) {
  const { _avg, _count, _sum } = await db.review.aggregate({ where: { resourceId }, _avg: { rating: true }, _count: true, _sum: { rating: true } });
  const count = _count;
  await db.resource.update({
    where: { id: resourceId },
    data: {
      ratingAvg: _avg.rating ?? 0,
      ratingCount: count,
      ratingScore: count ? ((_sum.rating ?? 0) + PRIOR_COUNT * PRIOR_MEAN) / (count + PRIOR_COUNT) : 0,
    },
  });
}

// Note moyenne de toutes les ressources d'un vendeur (encart « Vendeur » et Mon espace)
export async function sellerRating(sellerId: string) {
  const { _avg, _count } = await db.review.aggregate({ where: { resource: { sellerId } }, _avg: { rating: true }, _count: true });
  return { rating: _count ? (_avg.rating ?? 0) : null, reviews: _count };
}
