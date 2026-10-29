"use server";

// Modération → Revenus : actions sur l'argent des vendeurs, réservées au propriétaire du site.
// Débloquer ou rebloquer un gain, verser tout de suite (un gain ou tout ce qui est disponible),
// valider un projet sur mesure livré qui attend le client.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, siteOwnerId } from "@/lib/auth";
import { logModeration } from "@/lib/moderation";
import { payoutSeller } from "@/lib/payouts";
import { isDemoMode } from "@/lib/payments";
import { releaseProject } from "@/lib/projects";
import { HOLD_DAYS } from "@/lib/earnings";

const DAY = 24 * 60 * 60 * 1000;
const euros = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

async function requireOwner() {
  const admin = await requireAdmin();
  const ownerId = await siteOwnerId();
  if (admin.id !== ownerId) redirect("/admin");
  return { admin, ownerId };
}

async function sellerOf(formData: FormData) {
  const seller = await db.user.findUnique({ where: { id: String(formData.get("sellerId")) }, select: { id: true, username: true, stripeAccountId: true } });
  if (!seller) redirect("/admin/earnings");
  return seller;
}

// Retour sur la fiche du vendeur, avec un message (msg) et un détail (info)
function back(sellerId: string, msg: string, info = ""): never {
  revalidatePath("/admin/earnings");
  revalidatePath("/dashboard/sales");
  redirect(`/admin/earnings?${new URLSearchParams({ id: sellerId, msg, ...(info && { info }) })}`);
}

// Gains choisis : un seul (earningId) ou tous les gains en attente pas encore réservés par un versement
function pendingWhere(sellerId: string, formData: FormData) {
  const one = formData.get("earningId");
  return { sellerId, status: "PENDING", payoutId: null, ...(one && { id: String(one) }) };
}

// Vire tout de suite (sans minimum) les gains disponibles choisis
async function payNow(seller: { id: string; stripeAccountId: string | null }, ownerId: string | null, earningIds?: string[]) {
  if (!seller.stripeAccountId || isDemoMode) return { ok: false, info: "pas de compte Stripe" };
  const result = await payoutSeller({ id: seller.id, stripeAccountId: seller.stripeAccountId }, ownerId, new Date(), 1, earningIds);
  if (result.status === "PAID") return { ok: true, info: euros(result.amountCents) };
  return { ok: false, info: result.reason ?? "échec" };
}

// Débloquer : fin du délai de sécurité (le gain devient disponible, versé lundi ou avec « Verser »)
export async function releaseEarnings(formData: FormData) {
  const { admin } = await requireOwner();
  const seller = await sellerOf(formData);
  const now = new Date();
  const { count } = await db.sellerEarning.updateMany({ where: { ...pendingWhere(seller.id, formData), availableAt: { gt: now } }, data: { availableAt: now } });
  await logModeration({ moderatorId: admin.id, action: "EARNINGS_RELEASE", targetType: "user", targetId: seller.id, label: seller.username, note: `${count} gain(s)` });
  back(seller.id, "released", String(count));
}

// Rebloquer : remet un délai de sécurité de 7 jours (par exemple en cas de doute sur une vente)
export async function holdEarnings(formData: FormData) {
  const { admin } = await requireOwner();
  const seller = await sellerOf(formData);
  const { count } = await db.sellerEarning.updateMany({ where: { ...pendingWhere(seller.id, formData), amountCents: { gt: 0 } }, data: { availableAt: new Date(Date.now() + HOLD_DAYS * DAY) } });
  await logModeration({ moderatorId: admin.id, action: "EARNINGS_HOLD", targetType: "user", targetId: seller.id, label: seller.username, note: `${count} gain(s), ${HOLD_DAYS} jours` });
  back(seller.id, "held", String(count));
}

// Verser maintenant : débloque les gains choisis puis les vire tout de suite sur le compte Stripe du vendeur
export async function payEarnings(formData: FormData) {
  const { admin, ownerId } = await requireOwner();
  const seller = await sellerOf(formData);
  const now = new Date();
  const where = pendingWhere(seller.id, formData);
  await db.sellerEarning.updateMany({ where: { ...where, availableAt: { gt: now } }, data: { availableAt: now } });
  const ids = where.id ? [where.id] : undefined;
  const result = await payNow(seller, ownerId, ids);
  await logModeration({ moderatorId: admin.id, action: "EARNINGS_PAYOUT", targetType: "user", targetId: seller.id, label: seller.username, note: result.ok ? `${result.info} versés` : `pas versé : ${result.info}` });
  back(seller.id, result.ok ? "paid" : "notPaid", result.info);
}

// Projet sur mesure livré qui attend la validation du client : validé maintenant (le gain du développeur est créé)
export async function releaseDeliveredProject(formData: FormData) {
  const { admin } = await requireOwner();
  const seller = await sellerOf(formData);
  const project = await db.project.findFirst({ where: { id: String(formData.get("projectId")), devId: seller.id, status: "DELIVERED" }, select: { id: true, title: true } });
  if (!project) back(seller.id, "projectNo");
  const done = await releaseProject(project.id, "admin", "Validé depuis Modération → Revenus");
  if (done) await logModeration({ moderatorId: admin.id, action: "PROJECT_RELEASE", targetType: "project", targetId: project.id, label: project.title, note: "depuis Revenus" });
  back(seller.id, done ? "projectDone" : "projectNo");
}
