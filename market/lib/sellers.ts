import "server-only";
import { db } from "./db";

// Programme « vendeurs fondateurs » : les premiers vendeurs payent une commission réduite pendant quelques mois.
// Pour l'instant la page l'annonce ; l'application réelle du taux réduit viendra avec le paiement des vendeurs.
export const FOUNDER_SPOTS = 10;
export const FOUNDER_FEE_PERCENT = 5;
export const FOUNDER_MONTHS = 6;

// Places restantes : un vendeur occupe une place dès qu'il a une ressource en ligne
export async function founderSpotsLeft() {
  const sellers = await db.user.count({ where: { resources: { some: { status: "APPROVED" } } } });
  return Math.max(0, FOUNDER_SPOTS - sellers);
}
