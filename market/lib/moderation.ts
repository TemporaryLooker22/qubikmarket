import "server-only";
import { db } from "./db";
import { REPORTED_MEMBER_REVIEWS } from "./member-reviews";
import { refreshRating } from "./reviews";

// Modération : journal des décisions et bannissement des membres.

export type ModerationAction = "APPROVE" | "REJECT" | "KEEP" | "UNLIST" | "RELIST" | "EDIT" | "DELETE" | "REANALYZE" | "REVIEW_DELETE" | "REPORTS_DISMISS" | "BAN" | "UNBAN" | "CHAT_DISMISS" | "CHAT_MESSAGE_DELETE" | "MEMBER_REVIEW_DELETE" | "AVATAR_REMOVE";

// Garde une trace de chaque décision (page Modération → Journal)
export async function logModeration(entry: {
  moderatorId: string;
  action: ModerationAction;
  targetType: "resource" | "version" | "review" | "user" | "conversation";
  targetId: string;
  label: string;
  note?: string | null;
}) {
  await db.moderationLog.create({ data: { ...entry, note: entry.note || null } });
}

// Bannir : plus de connexion (lib/auth.ts), ressources en ligne retirées de la vente
// (les acheteurs gardent leur téléchargement), avis masqués et notes recalculées.
export async function banUser(userId: string, reason: string | null) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { bannedAt: new Date(), banReason: reason } }),
    db.resource.updateMany({ where: { sellerId: userId, status: "APPROVED" }, data: { status: "UNLISTED", unlistedByBan: true } }),
  ]);
  await refreshReviewedResources(userId);
}

// Débannir : tout revient comme avant (ressources retirées par le bannissement remises en vente, avis visibles)
export async function unbanUser(userId: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { bannedAt: null, banReason: null } }),
    db.resource.updateMany({ where: { sellerId: userId, unlistedByBan: true, status: "UNLISTED" }, data: { status: "APPROVED", unlistedByBan: false } }),
  ]);
  await refreshReviewedResources(userId);
}

async function refreshReviewedResources(userId: string) {
  const reviews = await db.review.findMany({ where: { userId }, select: { resourceId: true } });
  for (const r of reviews) await refreshRating(r.resourceId);
}

// ---------- Compteurs du menu de la modération ----------

// Ressources en attente (vendeur non banni) et nouvelles versions de ressources en ligne
export const QUEUE_RESOURCES = { status: "PENDING", seller: { bannedAt: null } };
export const QUEUE_VERSIONS = { status: "PENDING", resource: { status: { in: ["APPROVED", "UNLISTED"] } } };
// Ressources en ligne signalées par l'IA, pas encore examinées
export const AI_FLAGS = { status: "LIVE", aiFlagged: true, aiReviewed: false, resource: { status: "APPROVED" } };
// Avis signalés (signalements pas encore ignorés ; ceux des membres bannis sont déjà masqués)
export const REPORTED_REVIEWS = { reports: { some: { dismissedAt: null } }, user: { bannedAt: null } };

export async function moderationCounts() {
  const [resources, versions, flags, reports, chats] = await Promise.all([
    db.resource.count({ where: QUEUE_RESOURCES }),
    db.resourceVersion.count({ where: QUEUE_VERSIONS }),
    db.resourceVersion.count({ where: AI_FLAGS }),
    // Avis signalés : sur les ressources et sur les membres
    Promise.all([db.review.count({ where: REPORTED_REVIEWS }), db.memberReview.count({ where: REPORTED_MEMBER_REVIEWS })]).then(([a, b]) => a + b),
    // Conversations avec au moins un signalement en attente
    db.conversation.count({ where: { reports: { some: { dismissedAt: null } } } }),
  ]);
  return { queue: resources + versions, flags, reports, chats };
}
