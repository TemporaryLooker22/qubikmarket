"use server";

// Actions de la modération (admins) : bannir et débannir un membre (Utilisateurs),
// retirer, remettre en vente, réanalyser et supprimer des ressources (Ressources).
// Elles s'exécutent sur le serveur.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { banUser, logModeration, unbanUser } from "@/lib/moderation";
import { getDictionary } from "@/lib/i18n/server";
import { hasRobloxContent, type ScanReport } from "@/lib/scan";
import { deleteStored } from "@/lib/storage";
import { enqueueAnalysis, kickAiQueue } from "@/lib/ai/run";

function refreshSite() {
  revalidatePath("/", "layout");
}

export async function banMember(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true, role: true, bannedAt: true } });
  // On ne bannit ni un modérateur ni soi-même
  if (!user || user.bannedAt || user.role === "ADMIN" || user.id === admin.id) return;
  await banUser(user.id, reason);
  await logModeration({ moderatorId: admin.id, action: "BAN", targetType: "user", targetId: user.id, label: user.username, note: reason });
  refreshSite();
}

export async function unbanMember(formData: FormData) {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: String(formData.get("userId")) }, select: { id: true, username: true, bannedAt: true } });
  if (!user?.bannedAt) return;
  await unbanUser(user.id);
  await logModeration({ moderatorId: admin.id, action: "UNBAN", targetType: "user", targetId: user.id, label: user.username });
  refreshSite();
}

// ---------- Modération → Ressources : actions sur une ou plusieurs ressources ----------
// Un bouton de ligne lie l'action à sa ressource (target, via .bind) ; les actions groupées (target null)
// prennent les « ids » cochés dans le formulaire.

function pickedIds(target: string | null, formData: FormData) {
  return target ? [target] : [...new Set(formData.getAll("ids").map(String))].slice(0, 100);
}

function refreshResources(slugs: string[]) {
  for (const slug of slugs) revalidatePath(`/resources/${slug}`);
  revalidatePath("/", "layout");
}

// Retirer de la vente : la ressource quitte le catalogue, les acheteurs gardent leur téléchargement
export async function adminUnlist(target: string | null, formData: FormData) {
  const admin = await requireAdmin();
  const resources = await db.resource.findMany({ where: { id: { in: pickedIds(target, formData) }, status: "APPROVED" }, select: { id: true, slug: true, title: true } });
  await db.resource.updateMany({ where: { id: { in: resources.map((r) => r.id) } }, data: { status: "UNLISTED" } });
  for (const r of resources) await logModeration({ moderatorId: admin.id, action: "UNLIST", targetType: "resource", targetId: r.id, label: r.title });
  refreshResources(resources.map((r) => r.slug));
}

// Remettre en vente une ressource retirée
export async function adminRelist(target: string | null, formData: FormData) {
  const admin = await requireAdmin();
  const resources = await db.resource.findMany({ where: { id: { in: pickedIds(target, formData) }, status: "UNLISTED" }, select: { id: true, slug: true, title: true } });
  await db.resource.updateMany({ where: { id: { in: resources.map((r) => r.id) } }, data: { status: "APPROVED", unlistedByBan: false } });
  for (const r of resources) await logModeration({ moderatorId: admin.id, action: "RELIST", targetType: "resource", targetId: r.id, label: r.title });
  refreshResources(resources.map((r) => r.slug));
}

// Relancer l'analyse IA de la version en ligne (seulement les fichiers avec du contenu Roblox)
export async function adminReanalyze(target: string | null, formData: FormData) {
  const admin = await requireAdmin();
  const { locale } = await getDictionary();
  const resources = await db.resource.findMany({ where: { id: { in: pickedIds(target, formData) } }, select: { id: true, title: true, version: true } });
  const versions = await db.resourceVersion.findMany({
    where: { OR: resources.map((r) => ({ resourceId: r.id, version: r.version })) },
    select: { id: true, resourceId: true, scanReport: true },
  });
  const analyzable = versions.filter((v) => hasRobloxContent(JSON.parse(v.scanReport) as ScanReport));
  if (analyzable.length === 0) return;
  await enqueueAnalysis(analyzable.map((v) => v.id), locale);
  kickAiQueue();
  for (const v of analyzable) {
    const r = resources.find((x) => x.id === v.resourceId)!;
    await logModeration({ moderatorId: admin.id, action: "REANALYZE", targetType: "resource", targetId: r.id, label: r.title });
  }
  revalidatePath("/admin", "layout");
}

// Supprimer complètement (page, versions, avis, fichiers) : seulement une ressource sans vente.
// Une ressource vendue reste pour la comptabilité et le téléchargement des acheteurs : on la retire de la vente.
export async function adminDelete(id: string) {
  const admin = await requireAdmin();
  const resource = await db.resource.findUnique({
    where: { id },
    include: { versions: { select: { filePath: true } }, purchases: { select: { status: true } } },
  });
  if (!resource || resource.purchases.some((p) => p.status !== "PENDING")) return;
  await db.$transaction([
    db.purchase.deleteMany({ where: { resourceId: id } }), // paiements jamais terminés
    db.review.deleteMany({ where: { resourceId: id } }),
    db.resourceVersion.deleteMany({ where: { resourceId: id } }),
    db.resource.delete({ where: { id } }),
  ]);
  await deleteStored([...new Set([resource.filePath, ...resource.versions.map((v) => v.filePath), ...resource.images])]).catch((err) =>
    console.error("Suppression des fichiers :", err),
  );
  await logModeration({ moderatorId: admin.id, action: "DELETE", targetType: "resource", targetId: id, label: `${resource.title} (${resource.slug})` });
  refreshResources([resource.slug]);
}
