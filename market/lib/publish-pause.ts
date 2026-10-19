import "server-only";
import { db } from "@/lib/db";

// Règles de publication décidées par la modération (Modération → Utilisateurs) :
// - pause d'un membre : jusqu'à une date choisie, ou jusqu'à nouvel ordre, avec un motif facultatif
// - délai minimum entre deux publications : global (tous les vendeurs) ou propre à un membre
// Elles ne concernent que les nouvelles ressources : les ressources en ligne restent en vente, et le vendeur peut
// toujours les modifier ou publier une nouvelle version. Les modérateurs n'y sont pas soumis.

export const PUBLISH_PAUSE_DAYS = 2; // durée proposée par défaut
export const MAX_COOLDOWN_HOURS = 24 * 90;
const GLOBAL_COOLDOWN_KEY = "publishCooldownHours";

export type PublishPause = { until: Date | null; indefinite: boolean; reason: string | null; seen: boolean };

// La pause en cours du membre (null s'il n'en a pas ou si elle est terminée)
export async function publishPause(userId: string): Promise<PublishPause | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { publishPausedUntil: true, publishPauseIndefinite: true, publishPauseReason: true, publishPauseSeen: true },
  });
  if (!user) return null;
  if (user.publishPauseIndefinite) return { until: null, indefinite: true, reason: user.publishPauseReason, seen: user.publishPauseSeen };
  if (!user.publishPausedUntil || user.publishPausedUntil <= new Date()) return null;
  return { until: user.publishPausedUntil, indefinite: false, reason: user.publishPauseReason, seen: user.publishPauseSeen };
}

// ---------- Délai entre deux publications ----------

export async function globalCooldownHours() {
  const row = await db.siteSetting.findUnique({ where: { key: GLOBAL_COOLDOWN_KEY } });
  const n = Number(row?.value);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_COOLDOWN_HOURS) : 0;
}

export async function setGlobalCooldownHours(hours: number) {
  const value = String(Math.max(0, Math.min(MAX_COOLDOWN_HOURS, Math.round(hours))));
  await db.siteSetting.upsert({ where: { key: GLOBAL_COOLDOWN_KEY }, update: { value }, create: { key: GLOBAL_COOLDOWN_KEY, value } });
}

// Délai qui s'applique au membre (le sien s'il en a un, sinon le global) et date à partir de laquelle il pourra publier
export async function publishCooldown(userId: string) {
  const [user, global] = await Promise.all([db.user.findUnique({ where: { id: userId }, select: { publishCooldownHours: true, role: true } }), globalCooldownHours()]);
  if (!user || user.role === "ADMIN") return { hours: 0, own: false, nextAt: null };
  const own = user.publishCooldownHours !== null;
  const hours = own ? user.publishCooldownHours! : global;
  if (hours <= 0) return { hours: 0, own, nextAt: null };
  const last = await db.resource.findFirst({ where: { sellerId: userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const nextAt = last ? new Date(last.createdAt.getTime() + hours * 3600 * 1000) : null;
  return { hours, own, nextAt: nextAt && nextAt > new Date() ? nextAt : null };
}

// ---------- Affichage ----------

// Date et heure à l'heure belge (« 21 octobre à 18:40 »)
export function formatPauseEnd(date: Date, locale: "en" | "fr") {
  return date.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels" });
}

// Valeur pour un champ <input type="datetime-local">, à l'heure belge
export function toBrusselsInput(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// « 2026-10-25T18:00 » saisi à l'heure belge → date réelle (gère l'heure d'été et d'hiver)
export function fromBrusselsInput(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Décalage de Bruxelles à ce moment-là : on lit l'heure locale correspondant à asUtc et on corrige
  const shown = toBrusselsInput(new Date(asUtc)).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)!;
  const offset = Date.UTC(+shown[1], +shown[2] - 1, +shown[3], +shown[4], +shown[5]) - asUtc;
  const date = new Date(asUtc - offset);
  return Number.isNaN(date.getTime()) ? null : date;
}

// ---------- Blocage d'une nouvelle publication ----------

type BlockTexts = {
  blocked: (until: string) => string;
  blockedIndefinite: string;
  cooldown: (next: string, hours: number) => string;
  reasonLine: (reason: string) => string;
};

// Message à montrer au vendeur s'il ne peut pas publier maintenant (null s'il peut)
export async function publishBlockMessage(userId: string, texts: BlockTexts, locale: "en" | "fr") {
  const pause = await publishPause(userId);
  if (pause) {
    const base = pause.indefinite ? texts.blockedIndefinite : texts.blocked(formatPauseEnd(pause.until!, locale));
    return pause.reason ? `${base} ${texts.reasonLine(pause.reason)}` : base;
  }
  const cooldown = await publishCooldown(userId);
  if (cooldown.nextAt) return texts.cooldown(formatPauseEnd(cooldown.nextAt, locale), cooldown.hours);
  return null;
}
