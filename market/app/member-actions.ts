"use server";

// Profils des membres : avis sur un vendeur ou un client, réponse du membre noté, signalement,
// suppression par la modération, et photo de profil. Elles s'exécutent sur le serveur.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requireAdmin, requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { REVIEW_MAX } from "@/lib/reviews";
import { canMemberReview, MEMBER_ROLES, type MemberRole } from "@/lib/member-reviews";
import { isUploadedImage } from "@/lib/uploads";
import { deleteStored } from "@/lib/storage";
import { logModeration } from "@/lib/moderation";
import { links, notify, notifyAdmins } from "@/lib/notifications";
import type { ReviewState } from "./review-actions";

// Fenêtre « Pause de publication » fermée : elle ne s'affiche plus avant une nouvelle pause
export async function acknowledgePublishPause() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { publishPauseSeen: true } });
  revalidatePath("/", "layout");
}

function refreshProfile(username: string) {
  revalidatePath(`/u/${username}`);
  revalidatePath("/dashboard", "layout");
}

// Publier ou modifier son avis sur un vendeur (role SELLER) ou un client (role BUYER)
export async function submitMemberReview(_: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const role = String(formData.get("role")) as MemberRole;
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();
  if (!MEMBER_ROLES.includes(role)) return { error: t.errors.notFound };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: t.reviews.errorRating };
  if (body.length > REVIEW_MAX) return { error: t.reviews.errorLength(REVIEW_MAX) };

  const target = await db.user.findFirst({ where: { id: String(formData.get("targetId")), bannedAt: null }, select: { id: true, username: true } });
  if (!target) return { error: t.errors.notFound };
  if ((await canMemberReview(user.id, target.id, role)) !== "yes") return { error: role === "SELLER" ? t.profile.downloadFirst : t.profile.buyerDownloadFirst };

  const key = { authorId_targetId_role: { authorId: user.id, targetId: target.id, role } };
  const existing = await db.memberReview.findUnique({ where: key, select: { id: true } });
  await db.memberReview.upsert({
    where: key,
    create: { authorId: user.id, targetId: target.id, role, rating, body: body || null },
    update: { rating, body: body || null },
  });
  // Nouvel avis (pas une modification) : le membre noté est prévenu
  if (!existing) await notify(target.id, role === "SELLER" ? "SELLER_REVIEW" : "BUYER_REVIEW", { user: user.username, rating }, links.profile(target.username, role));
  refreshProfile(target.username);
  return { ok: existing ? t.reviews.updated : t.reviews.published };
}

// Réponse publique du membre noté (une réponse vide la retire)
export async function replyToMemberReview(_: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const reply = String(formData.get("reply") ?? "").trim();
  if (reply.length > REVIEW_MAX) return { error: t.reviews.errorLength(REVIEW_MAX) };
  const review = await db.memberReview.findUnique({ where: { id: String(formData.get("reviewId")) } });
  if (!review || review.targetId !== user.id) return { error: t.errors.notFound };
  await db.memberReview.update({ where: { id: review.id }, data: { reply: reply || null, repliedAt: reply ? new Date() : null } });
  // Première réponse : l'auteur de l'avis est prévenu
  if (reply && !review.reply) await notify(review.authorId, "MEMBER_REVIEW_REPLY", { user: user.username }, links.profile(user.username, review.role as MemberRole));
  refreshProfile(user.username);
  return { ok: reply ? t.reviews.replyPublished : t.reviews.replyRemoved };
}

// Signaler un avis sur un membre (insultes, faux avis…)
export async function reportMemberReview(_: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
  const review = await db.memberReview.findUnique({ where: { id: String(formData.get("reviewId")) }, select: { id: true, authorId: true } });
  if (!review || review.authorId === user.id) return { error: t.errors.notFound };
  await db.memberReviewReport.upsert({
    where: { reviewId_userId: { reviewId: review.id, userId: user.id } },
    create: { reviewId: review.id, userId: user.id, reason },
    update: { reason, dismissedAt: null, createdAt: new Date() },
  });
  await notifyAdmins("MOD_REPORT", { user: user.username }, "/admin/reviews");
  revalidatePath("/admin", "layout");
  return { ok: t.reviews.reported };
}

// ---------- Modération ----------

async function reviewLabel(id: string) {
  const r = await db.memberReview.findUnique({ where: { id }, include: { author: { select: { username: true } }, target: { select: { username: true } } } });
  return r ? { review: r, label: `${r.author.username} → ${r.target.username}` } : null;
}

export async function deleteMemberReview(formData: FormData) {
  const admin = await requireAdmin();
  const found = await reviewLabel(String(formData.get("reviewId")));
  if (!found) return;
  const { review, label } = found;
  await db.memberReview.delete({ where: { id: review.id } });
  await logModeration({
    moderatorId: admin.id,
    action: "MEMBER_REVIEW_DELETE",
    targetType: "user",
    targetId: review.targetId,
    label,
    note: review.body ? `${review.rating}★ « ${review.body.slice(0, 120)} »` : `${review.rating}★`,
  });
  await notify(review.authorId, "MEMBER_REVIEW_REMOVED", { user: review.target.username }, null);
  refreshProfile(review.target.username);
  revalidatePath("/admin", "layout");
}

export async function dismissMemberReviewReports(formData: FormData) {
  const admin = await requireAdmin();
  const found = await reviewLabel(String(formData.get("reviewId")));
  if (!found) return;
  await db.memberReviewReport.updateMany({ where: { reviewId: found.review.id, dismissedAt: null }, data: { dismissedAt: new Date() } });
  await logModeration({ moderatorId: admin.id, action: "REPORTS_DISMISS", targetType: "user", targetId: found.review.targetId, label: found.label });
  revalidatePath("/admin", "layout");
}

// ---------- Photo de profil ----------

// Enregistre la photo déjà recadrée et envoyée dans le stockage (voir components/profile/AvatarEditor.tsx)
export async function setAvatar(url: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !(await isUploadedImage(url))) return { ok: false };
  const before = await db.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
  await db.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
  if (before?.avatarUrl) await deleteStored([before.avatarUrl]).catch(() => {});
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAvatar() {
  const user = await requireUser();
  const before = await db.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });
  if (!before?.avatarUrl) return;
  await db.user.update({ where: { id: user.id }, data: { avatarUrl: null } });
  await deleteStored([before.avatarUrl]).catch(() => {});
  revalidatePath("/", "layout");
}

// Modération → Utilisateurs : retirer une photo inappropriée
export async function adminRemoveAvatar(formData: FormData) {
  const admin = await requireAdmin();
  const member = await db.user.findUnique({ where: { id: String(formData.get("userId")) }, select: { id: true, username: true, avatarUrl: true } });
  if (!member?.avatarUrl) return;
  await db.user.update({ where: { id: member.id }, data: { avatarUrl: null } });
  await deleteStored([member.avatarUrl]).catch(() => {});
  await logModeration({ moderatorId: admin.id, action: "AVATAR_REMOVE", targetType: "user", targetId: member.id, label: member.username });
  revalidatePath("/", "layout");
}
