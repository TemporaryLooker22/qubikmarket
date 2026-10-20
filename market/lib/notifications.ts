import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

// Notifications des membres (cloche de la barre de navigation).
// On enregistre seulement le type et quelques données ; le texte est écrit à l'affichage, dans la langue
// du visiteur (bloc « notif » des dictionnaires). Une notification qui échoue ne bloque jamais l'action.

export type NotificationType =
  // Vendeur : argent
  | "SALE" // vente payée (data.setup : versements pas encore configurés)
  | "FREE_GET" // ressource gratuite obtenue
  | "REFUND" // vente remboursée
  | "DISPUTE" // contestation bancaire ouverte
  | "DISPUTE_WON" // contestation gagnée
  | "PAYOUT" // versement envoyé sur son compte
  | "FOUNDER" // devenu vendeur fondateur
  // Vendeur : ses ressources
  | "RES_LIVE" // en ligne après l'analyse IA
  | "RES_HELD" // envoyée en vérification (data.reason : description, content, scan)
  | "RES_APPROVED" // approuvée par un modérateur
  | "RES_REJECTED" // refusée par un modérateur (data.note)
  | "RES_UNLISTED" // retirée de la vente par la modération
  | "RES_RELISTED" // remise en vente
  | "RES_DELETED" // supprimée par la modération
  | "RES_EDITED" // modifiée par un modérateur (data.part)
  | "VER_LIVE" // nouvelle version en ligne
  | "VER_HELD" // nouvelle version en vérification
  | "VER_REJECTED" // nouvelle version refusée (data.note)
  // Avis
  | "REVIEW_NEW" // nouvel avis sur sa ressource
  | "REVIEW_REPLY" // le vendeur a répondu à son avis
  | "REVIEW_REMOVED" // son avis a été supprimé par la modération
  // Avis entre membres (profils)
  | "SELLER_REVIEW" // un acheteur a noté le vendeur
  | "BUYER_REVIEW" // un vendeur a noté le client
  | "MEMBER_REVIEW_REPLY" // le membre noté a répondu à son avis
  | "MEMBER_REVIEW_REMOVED" // son avis sur un membre a été supprimé par la modération
  // Acheteur
  | "NEW_VERSION" // nouvelle version d'une ressource achetée
  // Modérateurs
  | "MOD_PENDING" // nouvel élément à vérifier
  | "MOD_FLAG" // ressource en ligne signalée par l'IA
  | "MOD_REPORT" // avis signalé
  | "MOD_CHAT" // conversation signalée
  | "MOD_PROJECT" // litige ouvert sur un projet sur mesure
  // Projets sur mesure (voir lib/projects.ts)
  | "PROJECT_OFFER" // client : un développeur a fait une offre
  | "PROJECT_CHOSEN" // développeur : son offre a été choisie
  | "PROJECT_PAID" // développeur : le client a payé, le projet commence
  | "PROJECT_MESSAGE" // nouveau message dans la conversation du projet
  | "PROJECT_DELIVERED" // client : le développeur a livré
  | "PROJECT_REVISION" // développeur : le client demande des modifications
  | "PROJECT_COMPLETED" // projet validé, développeur payé
  | "PROJECT_DISPUTE" // un litige est ouvert
  | "PROJECT_REFUNDED" // client remboursé
  | "PROJECT_CANCELED" // projet annulé avant paiement
  // Messagerie
  | "MESSAGE"; // nouveau message (une seule notification par conversation tant qu'elle n'est pas lue)

export type NotificationData = {
  title?: string; // titre de la ressource
  amount?: number; // en centimes
  user?: string; // pseudo de l'autre membre (acheteur, auteur de l'avis…)
  version?: string;
  note?: string; // note du modérateur
  rating?: number;
  reason?: "description" | "content" | "scan";
  part?: string; // partie modifiée par un modérateur (infos, images…)
  setup?: boolean;
  months?: number;
};

type Client = Prisma.TransactionClient | typeof db;

export async function notify(userIds: string | string[], type: NotificationType, data: NotificationData, link: string | null, client: Client = db) {
  const ids = [...new Set(typeof userIds === "string" ? [userIds] : userIds)];
  if (ids.length === 0) return;
  try {
    await client.notification.createMany({ data: ids.map((userId) => ({ userId, type, data, link })) });
  } catch (err) {
    console.error("Notification :", err);
  }
}

// Tous les modérateurs (sauf celui qui vient d'agir)
export async function notifyAdmins(type: NotificationType, data: NotificationData, link: string, exceptId?: string) {
  const admins = await db.user.findMany({ where: { role: "ADMIN", ...(exceptId && { id: { not: exceptId } }) }, select: { id: true } });
  await notify(
    admins.map((a) => a.id),
    type,
    data,
    link,
  );
}

// Acheteurs d'une ressource (achat payé ou ressource gratuite obtenue)
export async function buyerIds(resourceId: string, client: Client = db) {
  const purchases = await client.purchase.findMany({ where: { resourceId, status: "PAID" }, select: { userId: true } });
  return purchases.map((p) => p.userId);
}

// Liens des notifications
export const links = {
  sales: "/dashboard/sales",
  purchases: "/dashboard/purchases",
  resource: (slug: string) => `/resources/${slug}`,
  reviews: (slug: string) => `/resources/${slug}#avis`,
  report: (id: string) => `/dashboard/resources?report=${id}#${id}`,
  versions: (id: string) => `/dashboard/resources/${id}/edit?tab=versions`,
  chat: (id: string) => `/messages/${id}`,
  profile: (username: string, role?: "SELLER" | "BUYER") => `/u/${encodeURIComponent(username)}${role ? `?tab=${role === "SELLER" ? "seller" : "buyer"}#avis` : ""}`,
  adminChat: (id: string) => `/admin/messages/${id}`,
  project: (id: string) => `/projects/work/${id}`,
  projectRequest: (id: string) => `/projects/${id}`,
};
