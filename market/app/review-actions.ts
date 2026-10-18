"use server";

// Avis des acheteurs : publier ou modifier son avis, réponse du vendeur, suppression par un modérateur.
// Elles s'exécutent sur le serveur.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { canReview, refreshRating, REVIEW_MAX } from "@/lib/reviews";

export type ReviewState = { error?: string; ok?: string } | undefined;

function refresh(slug: string) {
  revalidatePath(`/resources/${slug}`);
  revalidatePath("/resources");
  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
}

// Publier ou modifier son avis (un seul par ressource)
export async function submitReview(_: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const resourceId = String(formData.get("resourceId"));
  const rating = Number(formData.get("rating"));
  const body = String(formData.get("body") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: t.reviews.errorRating };
  if (body.length > REVIEW_MAX) return { error: t.reviews.errorLength(REVIEW_MAX) };
  const resource = await db.resource.findUnique({ where: { id: resourceId }, select: { id: true, slug: true, version: true, sellerId: true } });
  if (!resource || resource.sellerId === user.id) return { error: t.errors.notFound };
  if ((await canReview(user.id, resource.id)) !== "yes") return { error: t.reviews.downloadFirst };

  const existing = await db.review.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId } }, select: { id: true } });
  await db.review.upsert({
    where: { userId_resourceId: { userId: user.id, resourceId } },
    create: { userId: user.id, resourceId, rating, body: body || null, version: resource.version },
    update: { rating, body: body || null, version: resource.version },
  });
  await refreshRating(resource.id);
  refresh(resource.slug);
  return { ok: existing ? t.reviews.updated : t.reviews.published };
}

// Réponse publique du vendeur à un avis (une réponse vide la retire)
export async function replyToReview(_: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const reply = String(formData.get("reply") ?? "").trim();
  if (reply.length > REVIEW_MAX) return { error: t.reviews.errorLength(REVIEW_MAX) };
  const review = await db.review.findUnique({ where: { id: String(formData.get("reviewId")) }, include: { resource: { select: { slug: true, sellerId: true } } } });
  if (!review || review.resource.sellerId !== user.id) return { error: t.errors.notFound };
  await db.review.update({ where: { id: review.id }, data: { reply: reply || null, repliedAt: reply ? new Date() : null } });
  refresh(review.resource.slug);
  return { ok: reply ? t.reviews.replyPublished : t.reviews.replyRemoved };
}

// Suppression d'un avis par un modérateur (insultes, spam, hors sujet…)
export async function deleteReview(formData: FormData) {
  await requireAdmin();
  const review = await db.review.findUnique({ where: { id: String(formData.get("reviewId")) }, include: { resource: { select: { slug: true } } } });
  if (!review) return;
  await db.review.delete({ where: { id: review.id } });
  await refreshRating(review.resourceId);
  refresh(review.resource.slug);
}
