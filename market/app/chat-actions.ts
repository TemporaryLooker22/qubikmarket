"use server";

// Actions de la messagerie : envoyer un message, bloquer, signaler une conversation,
// et côté modération : classer un signalement, supprimer un message. Elles s'exécutent sur le serveur.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { compressUploadedImage, isUploadedImage } from "@/lib/uploads";
import { links, notify, notifyAdmins } from "@/lib/notifications";
import { logModeration } from "@/lib/moderation";
import { MESSAGE_MAX_IMAGES, MESSAGE_MAX_LENGTH, mentionsOffPlatform, REPORT_REASONS, type ReportReason } from "@/lib/chat-text";
import { markConversationRead, MESSAGE_SELECT, otherIdOf, pairOf, rateLimited, sendBlock, toChatMessages, touchLastSeen, type ChatMessage, type SendBlock } from "@/lib/chat";

export type SendError = "login" | "empty" | "tooLong" | "images" | "minute" | "day" | "notFound" | SendBlock;
export type SendResult = { ok: true; conversationId: string; messages: ChatMessage[] } | { ok: false; error: SendError };

// Envoie un message. Première fois avec ce membre : `to` (son identifiant) ; ensuite : `conversationId`.
// `aboutId` : la ressource depuis laquelle on a cliqué « Contacter le vendeur » (carte « À propos de »).
export async function sendMessage(input: { conversationId?: string; to?: string; aboutId?: string; body: string; images: string[] }): Promise<SendResult> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "login" };

  const body = String(input.body ?? "").trim();
  let images = Array.isArray(input.images) ? input.images.map(String) : [];
  if (!body && images.length === 0) return { ok: false, error: "empty" };
  if (body.length > MESSAGE_MAX_LENGTH) return { ok: false, error: "tooLong" };
  if (images.length > MESSAGE_MAX_IMAGES) return { ok: false, error: "images" };

  // La conversation existante, ou le membre à qui on écrit pour la première fois
  let conversation = input.conversationId
    ? await db.conversation.findFirst({ where: { id: input.conversationId, OR: [{ userAId: me.id }, { userBId: me.id }] } })
    : null;
  if (input.conversationId && !conversation) return { ok: false, error: "notFound" };
  const otherId = conversation ? otherIdOf(conversation, me.id) : String(input.to ?? "");
  if (!conversation) conversation = await db.conversation.findUnique({ where: { userAId_userBId: pairOf(me.id, otherId) } });

  const blocked = await sendBlock(me.id, otherId);
  if (blocked) return { ok: false, error: blocked };
  const limited = await rateLimited(me.id, !conversation);
  if (limited) return { ok: false, error: limited };
  // Images : seulement celles envoyées dans notre stockage, vérifiées une par une
  if (images.length && !(await Promise.all(images.map(isUploadedImage))).every(Boolean)) return { ok: false, error: "images" };
  // Compressées avant d'être gardées (affichées en grand dans la conversation)
  images = await Promise.all(images.map((url) => compressUploadedImage(url)));

  // Carte « À propos de » : une seule fois par ressource dans la conversation
  let aboutId: string | null = null;
  if (input.aboutId) {
    const resource = await db.resource.findFirst({ where: { id: String(input.aboutId), status: "APPROVED", sellerId: { in: [me.id, otherId] } }, select: { id: true } });
    const already = resource && conversation ? await db.message.count({ where: { conversationId: conversation.id, kind: "ABOUT", resourceId: resource.id } }) : 0;
    if (resource && !already) aboutId = resource.id;
  }

  // Temps de réponse : depuis le premier message de l'autre resté sans réponse
  let replyMs: number | null = null;
  if (conversation) {
    const myLast = await db.message.findFirst({ where: { conversationId: conversation.id, senderId: me.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const waiting = await db.message.findFirst({
      where: { conversationId: conversation.id, senderId: otherId, kind: "TEXT", ...(myLast && { createdAt: { gt: myLast.createdAt } }) },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    if (waiting) replyMs = Math.min(Date.now() - waiting.createdAt.getTime(), 2_000_000_000);
  }

  const now = new Date();
  const pair = pairOf(me.id, otherId);
  const created = await db.$transaction(async (tx) => {
    const conv = await tx.conversation.upsert({ where: { userAId_userBId: pair }, create: { ...pair, startedById: me.id }, update: {} });
    const list = [];
    if (aboutId) list.push(await tx.message.create({ data: { conversationId: conv.id, senderId: me.id, kind: "ABOUT", resourceId: aboutId, createdAt: new Date(now.getTime() - 1) }, select: MESSAGE_SELECT }));
    list.push(
      await tx.message.create({
        data: { conversationId: conv.id, senderId: me.id, body, images, offPlatform: mentionsOffPlatform(body), replyMs, createdAt: now },
        select: MESSAGE_SELECT,
      }),
    );
    await tx.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: now, lastSenderId: me.id, lastPreview: body.slice(0, 140) || "📷", ...(conv.userAId === me.id ? { readA: now } : { readB: now }) },
    });
    return { conversationId: conv.id, list };
  });

  // Une seule notification par conversation tant que l'autre ne l'a pas lue
  const link = links.chat(created.conversationId);
  const pending = await db.notification.count({ where: { userId: otherId, type: "MESSAGE", link, readAt: null } });
  if (!pending) await notify(otherId, "MESSAGE", { user: me.username }, link);
  await touchLastSeen(me.id);

  return { ok: true, conversationId: created.conversationId, messages: await toChatMessages(created.list) };
}

// Bloquer / débloquer un membre : plus aucun message possible entre vous deux
export async function blockMember(otherId: string) {
  const me = await getCurrentUser();
  if (!me || me.id === otherId) return;
  await db.block.upsert({ where: { blockerId_blockedId: { blockerId: me.id, blockedId: otherId } }, create: { blockerId: me.id, blockedId: otherId }, update: {} });
  revalidatePath("/messages", "layout");
}

export async function unblockMember(otherId: string) {
  const me = await getCurrentUser();
  if (!me) return;
  await db.block.deleteMany({ where: { blockerId: me.id, blockedId: otherId } });
  revalidatePath("/messages", "layout");
}

// Signaler une conversation : elle devient lisible par la modération
export async function reportConversation(conversationId: string, reason: ReportReason, note: string): Promise<{ ok: boolean }> {
  const me = await getCurrentUser();
  if (!me || !REPORT_REASONS.includes(reason)) return { ok: false };
  const conversation = await db.conversation.findFirst({ where: { id: conversationId, OR: [{ userAId: me.id }, { userBId: me.id }] }, select: { id: true } });
  if (!conversation) return { ok: false };
  const text = String(note ?? "").trim().slice(0, 500) || null;
  await db.conversationReport.upsert({
    where: { conversationId_userId: { conversationId, userId: me.id } },
    create: { conversationId, userId: me.id, reason, note: text },
    update: { reason, note: text, dismissedAt: null, createdAt: new Date() },
  });
  await notifyAdmins("MOD_CHAT", { user: me.username }, links.adminChat(conversationId), me.id);
  revalidatePath("/admin", "layout");
  return { ok: true };
}

// ---------- Modération ----------

async function conversationLabel(id: string) {
  const c = await db.conversation.findUnique({ where: { id }, select: { userA: { select: { username: true } }, userB: { select: { username: true } } } });
  return c ? `${c.userA.username} ↔ ${c.userB.username}` : id;
}

// Classer sans suite : les signalements en attente de cette conversation sont traités
export async function dismissChatReports(conversationId: string) {
  const admin = await requireAdmin();
  const { count } = await db.conversationReport.updateMany({ where: { conversationId, dismissedAt: null }, data: { dismissedAt: new Date() } });
  if (count) await logModeration({ moderatorId: admin.id, action: "CHAT_DISMISS", targetType: "conversation", targetId: conversationId, label: await conversationLabel(conversationId) });
  revalidatePath("/", "layout");
}

// Supprimer un message : son contenu disparaît pour les deux membres (« Message supprimé par la modération »)
export async function deleteChatMessage(messageId: string) {
  const admin = await requireAdmin();
  const message = await db.message.findUnique({ where: { id: messageId }, select: { id: true, conversationId: true, body: true, deletedAt: true, conversation: { select: { reports: { select: { id: true }, take: 1 } } } } });
  // Seulement dans une conversation signalée (les autres restent privées)
  if (!message || message.deletedAt || message.conversation.reports.length === 0) return;
  await db.message.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  await logModeration({
    moderatorId: admin.id,
    action: "CHAT_MESSAGE_DELETE",
    targetType: "conversation",
    targetId: message.conversationId,
    label: await conversationLabel(message.conversationId),
    note: message.body.slice(0, 300) || null,
  });
  revalidatePath(`/admin/messages/${message.conversationId}`);
}


// Fenêtre « Message de la modération » : « J'ai compris » marque la conversation comme lue
export async function acknowledgeModeratorMessage(conversationId: string) {
  const me = await getCurrentUser();
  if (!me) return;
  await markConversationRead(String(conversationId), me.id);
  revalidatePath("/", "layout");
}
