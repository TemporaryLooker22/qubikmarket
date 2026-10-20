import "server-only";
import { db } from "@/lib/db";

// Nombre de ressources regardées pour le tirage (les plus récentes)
const POOL_SIZE = 500;

const shuffle = <T>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// « À la une » de l'accueil : tirage au hasard à chaque visite, un vendeur différent par carte
// (chaque vendeur a la même chance, peu importe combien il a publié) et des catégories différentes
// tant que c'est possible. S'il n'y a pas assez de vendeurs, on complète avec d'autres ressources.
export async function pickFeatured(count = 3) {
  const pool = await db.resource.findMany({
    where: { status: "APPROVED", images: { isEmpty: false } },
    orderBy: { createdAt: "desc" },
    take: POOL_SIZE,
    select: { id: true, sellerId: true, category: true },
  });

  const bySeller = new Map<string, typeof pool>();
  for (const r of pool) bySeller.set(r.sellerId, [...(bySeller.get(r.sellerId) ?? []), r]);

  const picked: typeof pool = [];
  const usedCategories = new Set<string>();
  const sellers = shuffle([...bySeller.values()]);
  // 1er passage : seulement les vendeurs qui apportent une catégorie pas encore affichée ;
  // 2e passage : les autres vendeurs, avec n'importe laquelle de leurs ressources
  for (const strict of [true, false]) {
    for (const items of sellers) {
      if (picked.length >= count) break;
      if (picked.some((r) => r.sellerId === items[0].sellerId)) continue;
      const options = shuffle(items);
      const choice = options.find((r) => !usedCategories.has(r.category)) ?? (strict ? undefined : options[0]);
      if (!choice) continue;
      picked.push(choice);
      usedCategories.add(choice.category);
    }
  }
  // Pas assez de vendeurs différents : on complète avec d'autres ressources, d'autres catégories d'abord
  if (picked.length < count) {
    const rest = shuffle(pool.filter((r) => !picked.includes(r)));
    rest.sort((a, b) => Number(usedCategories.has(a.category)) - Number(usedCategories.has(b.category)));
    picked.push(...rest.slice(0, count - picked.length));
  }

  const ids = picked.map((r) => r.id);
  const resources = await db.resource.findMany({ where: { id: { in: ids } }, include: { seller: { select: { username: true } } } });
  return ids.flatMap((id) => resources.find((r) => r.id === id) ?? []);
}
