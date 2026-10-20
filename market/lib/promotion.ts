import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { PROMO_MAX } from "./promotion-shared";
import { feePercentFor } from "./earnings";

// Mise en avant payée par la commission : le vendeur choisit de laisser à Qubik entre sa commission normale
// (4 %, 3 % pour les fondateurs) et 15 % de ses ventes. Au-dessus de sa commission normale, la ressource
// apparaît dans les emplacements « Sponsorisé » (accueil, haut du catalogue, recherche, ressources similaires) :
// plus le pourcentage est haut, plus elle y apparaît souvent et en premier (tirage pondéré à chaque affichage).

export { PROMO_MAX };

// Commission appliquée à une vente : la plus haute entre la commission normale et celle choisie
export function effectiveFeePercent(baseFee: number, promoPercent: number | null | undefined) {
  return Math.min(PROMO_MAX, Math.max(baseFee, promoPercent ?? 0));
}

// Valeur enregistrée : vide si le vendeur garde sa commission normale (ou si la ressource est gratuite)
export function promoToStore(value: unknown, baseFee: number, priceCents: number): number | null {
  const n = Math.round(Number(value));
  if (!priceCents || !Number.isFinite(n) || n <= baseFee) return null;
  return Math.min(PROMO_MAX, n);
}

const cardInclude = { seller: { select: { username: true, founderUntil: true } } } as const;
type Candidate = Prisma.ResourceGetPayload<{ include: typeof cardInclude }>;

// Variété (accueil) : après chaque tirage, les autres ressources du même vendeur et de la même catégorie
// pèsent beaucoup moins, pour qu'un vendeur qui met en avant beaucoup de ressources ne remplisse pas toute la rangée
const SAME_SELLER_FACTOR = 0.1;
const SAME_CATEGORY_FACTOR = 0.4;

// Tirage pondéré sans remise : poids = points de commission au-dessus de la commission normale
function weightedPick<T>(items: { item: T; weight: number }[], count: number, spread?: (a: T, b: T) => number): T[] {
  const pool = items.filter((x) => x.weight > 0);
  const out: T[] = [];
  while (pool.length && out.length < count) {
    const weights = pool.map((x) => out.reduce((w, picked) => w * (spread ? spread(x.item, picked) : 1), x.weight));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * total;
    const index = weights.findIndex((w) => (r -= w) <= 0);
    out.push(pool.splice(index === -1 ? pool.length - 1 : index, 1)[0].item);
  }
  return out;
}

// Ressources mises en avant à afficher (catégorie ou recherche facultatives)
export async function pickPromoted(opts: { count: number; category?: string; query?: string; excludeIds?: string[]; varied?: boolean }): Promise<Candidate[]> {
  const q = opts.query?.trim();
  const candidates = await db.resource.findMany({
    where: {
      status: "APPROVED",
      priceCents: { gt: 0 },
      promoPercent: { not: null },
      ...(opts.category && { category: opts.category }),
      ...(opts.excludeIds?.length && { id: { notIn: opts.excludeIds } }),
      ...(q && { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { summary: { contains: q, mode: "insensitive" as const } }] }),
      seller: { bannedAt: null },
    },
    include: cardInclude,
    take: 200,
  });
  const now = new Date();
  return weightedPick(
    candidates.map((r) => {
      const extra = (r.promoPercent ?? 0) - feePercentFor(r.seller, now);
      // Un point au-dessus de la commission normale compte peu, 11 points beaucoup plus (courbe un peu plus forte que linéaire)
      return { item: r, weight: extra > 0 ? Math.pow(extra, 1.4) : 0 };
    }),
    opts.count,
    opts.varied ? (a, b) => (a.sellerId === b.sellerId ? SAME_SELLER_FACTOR : 1) * (a.category === b.category ? SAME_CATEGORY_FACTOR : 1) : undefined,
  );
}
