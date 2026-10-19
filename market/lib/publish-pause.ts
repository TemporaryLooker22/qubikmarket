import "server-only";
import { db } from "@/lib/db";

// Pause de publication : la modération peut empêcher un vendeur de publier de nouvelles ressources pendant
// quelques jours, pour laisser de la place aux autres vendeurs. Ses ressources déjà en ligne restent en vente
// et il peut toujours les modifier ou publier une nouvelle version.
export const PUBLISH_PAUSE_DAYS = 2;

// La pause en cours du membre (null s'il n'en a pas ou si elle est terminée)
export async function publishPause(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { publishPausedUntil: true, publishPauseSeen: true } });
  if (!user?.publishPausedUntil || user.publishPausedUntil <= new Date()) return null;
  return { until: user.publishPausedUntil, seen: user.publishPauseSeen };
}

// Date et heure de fin, à l'heure belge (« 21 octobre à 18:40 »)
export function formatPauseEnd(date: Date, locale: "en" | "fr") {
  return date.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
}
