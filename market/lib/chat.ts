import "server-only";
import { db } from "./db";
import { links } from "./notifications";
import { ONLINE_MS, responseBucket, type ResponseBucket } from "./chat-text";

// Messagerie privée entre membres : un seul fil par paire de membres (voir le modèle Conversation).
// Les conversations restent privées : la modération ne lit que celles qui ont été signalées.

const DAY = 24 * 60 * 60 * 1000;
export const LIMITS = {
  perMinute: 20, // messages envoyés par minute
  newPerDayYoung: 5, // nouvelles conversations par jour, comptes de moins de 7 jours
  newPerDay: 30,
  youngDays: 7,
};

// Les deux membres sont rangés dans l'ordre de leurs identifiants : une seule conversation possible par paire
export function pairOf(a: string, b: string) {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

type ConvSides = { userAId: string; userBId: string; readA: Date | null; readB: Date | null };
export const otherIdOf = (c: ConvSides, me: string) => (c.userAId === me ? c.userBId : c.userAId);
export const myReadOf = (c: ConvSides, me: string) => (c.userAId === me ? c.readA : c.readB);
export const otherReadOf = (c: ConvSides, me: string) => (c.userAId === me ? c.readB : c.readA);

// Conversations du membre (A ou B)
export const mine = (userId: string) => ({ OR: [{ userAId: userId }, { userBId: userId }] });

// Conversations avec des messages non lus (dernier message de l'autre, après la dernière lecture)
export async function unreadConversations(userId: string) {
  const rows = await db.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM "Conversation"
    WHERE "lastSenderId" IS NOT NULL AND "lastSenderId" <> ${userId}
      AND (("userAId" = ${userId} AND ("readA" IS NULL OR "readA" < "lastMessageAt"))
        OR ("userBId" = ${userId} AND ("readB" IS NULL OR "readB" < "lastMessageAt")))`;
  return Number(rows[0]?.n ?? 0);
}

// Pourquoi on ne peut pas écrire à quelqu'un (null : c'est possible)
export type SendBlock = "self" | "missing" | "banned" | "blockedByMe" | "blockedMe";
export async function sendBlock(meId: string, otherId: string): Promise<SendBlock | null> {
  if (meId === otherId) return "self";
  const [other, blocks] = await Promise.all([
    db.user.findUnique({ where: { id: otherId }, select: { bannedAt: true } }),
    db.block.findMany({ where: { OR: [{ blockerId: meId, blockedId: otherId }, { blockerId: otherId, blockedId: meId }] } }),
  ]);
  if (!other) return "missing";
  if (other.bannedAt) return "banned";
  if (blocks.some((b) => b.blockerId === meId)) return "blockedByMe";
  if (blocks.length) return "blockedMe";
  return null;
}

// Anti-spam : trop de messages d'un coup, ou trop de nouvelles conversations aujourd'hui
export async function rateLimited(userId: string, newConversation: boolean): Promise<"minute" | "day" | null> {
  const now = Date.now();
  const recent = await db.message.count({ where: { senderId: userId, createdAt: { gte: new Date(now - 60_000) } } });
  if (recent >= LIMITS.perMinute) return "minute";
  if (!newConversation) return null;
  const [user, started] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true, role: true } }),
    db.conversation.count({ where: { startedById: userId, createdAt: { gte: new Date(now - DAY) } } }),
  ]);
  if (user?.role === "ADMIN") return null;
  const young = !user || now - user.createdAt.getTime() < LIMITS.youngDays * DAY;
  return started >= (young ? LIMITS.newPerDayYoung : LIMITS.newPerDay) ? "day" : null;
}

// Temps de réponse habituel : médiane des 20 dernières réponses (au moins 3 pour l'afficher)
export async function responseTime(userId: string): Promise<ResponseBucket | null> {
  const rows = await db.message.findMany({
    where: { senderId: userId, replyMs: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { replyMs: true },
  });
  if (rows.length < 3) return null;
  const sorted = rows.map((r) => r.replyMs!).sort((a, b) => a - b);
  return responseBucket(sorted[Math.floor(sorted.length / 2)]);
}

export const isOnline = (lastSeenAt: Date | null) => Boolean(lastSeenAt && Date.now() - lastSeenAt.getTime() < ONLINE_MS);

// Activité du membre (point vert) : enregistrée au plus une fois par minute
export async function touchLastSeen(userId: string) {
  await db.user.updateMany({ where: { id: userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: new Date(Date.now() - 60_000) } }] }, data: { lastSeenAt: new Date() } });
}

// Message tel qu'envoyé au navigateur (les cartes « À propos de » avec leur ressource)
export type ChatMessage = {
  id: string;
  senderId: string;
  kind: string;
  body: string;
  images: string[];
  offPlatform: boolean;
  deleted: boolean;
  createdAt: string;
  about: { slug: string; title: string; image: string | null; priceCents: number; category: string } | null;
};

type RawMessage = { id: string; senderId: string; kind: string; body: string; images: string[]; offPlatform: boolean; deletedAt: Date | null; createdAt: Date; resourceId: string | null };

export async function toChatMessages(list: RawMessage[]): Promise<ChatMessage[]> {
  const ids = [...new Set(list.map((m) => m.resourceId).filter((id): id is string => Boolean(id)))];
  const resources = ids.length
    ? new Map(
        (await db.resource.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, title: true, images: true, priceCents: true, category: true } })).map((r) => [r.id, r]),
      )
    : new Map();
  return list.map((m) => {
    const r = m.resourceId ? resources.get(m.resourceId) : undefined;
    return {
      id: m.id,
      senderId: m.senderId,
      kind: m.kind,
      // Message supprimé par la modération : le contenu n'est plus envoyé
      body: m.deletedAt ? "" : m.body,
      images: m.deletedAt ? [] : m.images,
      offPlatform: !m.deletedAt && m.offPlatform,
      deleted: Boolean(m.deletedAt),
      createdAt: m.createdAt.toISOString(),
      about: r ? { slug: r.slug, title: r.title, image: r.images[0] ?? null, priceCents: r.priceCents, category: r.category } : null,
    };
  });
}

export const MESSAGE_SELECT = { id: true, senderId: true, kind: true, body: true, images: true, offPlatform: true, deletedAt: true, createdAt: true, resourceId: true } as const;

// Signalements de conversations en attente (modération)
export const OPEN_CHAT_REPORTS = { dismissedAt: null } as const;

// Page ou rafraîchissement d'une conversation : marque comme lue pour le membre connecté
export async function markConversationRead(conversationId: string, meId: string) {
  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || (conversation.userAId !== meId && conversation.userBId !== meId)) return;
  const read = myReadOf(conversation, meId);
  if (!read || read < conversation.lastMessageAt) {
    await db.conversation.update({ where: { id: conversationId }, data: conversation.userAId === meId ? { readA: new Date() } : { readB: new Date() } });
  }
  await db.notification.updateMany({ where: { userId: meId, type: "MESSAGE", link: links.chat(conversationId), readAt: null }, data: { readAt: new Date() } });
}
