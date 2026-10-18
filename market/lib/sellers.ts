import "server-only";
import { db } from "./db";
import { notify } from "./notifications";

// Programme « vendeurs fondateurs » : les premiers vendeurs payent une commission réduite pendant quelques mois.
export const FOUNDER_SPOTS = 50;
export const FOUNDER_FEE_PERCENT = 3;
export const FOUNDER_MONTHS = 6;

// Places restantes : un vendeur devient fondateur quand sa première ressource passe en ligne
export async function founderSpotsLeft() {
  const founders = await db.user.count({ where: { founderUntil: { not: null } } });
  return Math.max(0, FOUNDER_SPOTS - founders);
}

// À appeler quand une ressource passe en ligne : le vendeur devient fondateur s'il reste des places
// (une seule fois : la date de fin ne bouge plus ensuite)
export async function grantFounderIfEligible(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { founderUntil: true } });
  if (!user || user.founderUntil) return;
  if ((await founderSpotsLeft()) === 0) return;
  const until = new Date();
  until.setMonth(until.getMonth() + FOUNDER_MONTHS);
  const { count } = await db.user.updateMany({ where: { id: userId, founderUntil: null }, data: { founderUntil: until } });
  if (count === 1) await notify(userId, "FOUNDER", { amount: FOUNDER_FEE_PERCENT, months: FOUNDER_MONTHS }, "/dashboard/sales");
}
