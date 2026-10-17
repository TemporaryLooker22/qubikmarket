import "server-only";
import { db } from "./db";
import { DEMO_ENABLED, DEMO_IMAGES } from "./demo";

// Miniatures pour les fonds animés (inscription, connexion) :
// celles de la démo si elle est active, sinon la première image des vraies ressources en ligne
export async function getShowcaseImages(): Promise<string[]> {
  if (DEMO_ENABLED) return DEMO_IMAGES;
  const resources = await db.resource.findMany({
    where: { status: "APPROVED", NOT: { images: { isEmpty: true } } },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { images: true },
  });
  return resources.map((r) => r.images[0]);
}
