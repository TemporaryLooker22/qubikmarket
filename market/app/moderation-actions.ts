"use server";

// Actions de la modération (admins) : bannir et débannir un membre (Utilisateurs),
// retirer, remettre en vente, réanalyser et supprimer des ressources (Ressources).
// Elles s'exécutent sur le serveur.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, siteOwnerId } from "@/lib/auth";
import { banUser, logModeration, unbanUser } from "@/lib/moderation";
import { links, notify } from "@/lib/notifications";
import { getDictionary } from "@/lib/i18n/server";
import { hasRobloxContent, type ScanReport } from "@/lib/scan";
import { deleteStored } from "@/lib/storage";
import { enqueueAnalysis, kickAiQueue, stopLiveReanalyses } from "@/lib/ai/run";
import { grantFounderIfEligible } from "@/lib/sellers";
import { compressStoredImages } from "@/lib/image-compression";
import { formatPauseEnd, fromBrusselsInput, MAX_COOLDOWN_HOURS, PUBLISH_PAUSE_DAYS, setGlobalCooldownHours } from "@/lib/publish-pause";

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

// ---------- Règles de publication d'un membre (Modération → Utilisateurs, voir lib/publish-pause.ts) ----------

const PAUSE_PRESETS: Record<string, number> = { "1d": 1, "2d": 2, "7d": 7, "30d": 30 };

// Pause de publication : durée proposée, date choisie ou jusqu'à nouvel ordre, avec un motif facultatif.
// Le membre voit une fenêtre d'information à sa prochaine visite.
export async function pausePublishing(formData: FormData) {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: String(formData.get("userId")) }, select: { id: true, username: true, role: true } });
  if (!user || user.role === "ADMIN") return;
  const mode = String(formData.get("mode") ?? "2d");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300) || null;
  let until: Date | null = null;
  if (mode === "custom") {
    until = fromBrusselsInput(String(formData.get("until") ?? ""));
    if (!until || until <= new Date()) return;
  } else if (mode !== "indefinite") {
    until = new Date(Date.now() + (PAUSE_PRESETS[mode] ?? PUBLISH_PAUSE_DAYS) * 24 * 3600 * 1000);
  }
  const indefinite = mode === "indefinite";
  await db.user.update({
    where: { id: user.id },
    data: { publishPausedUntil: until, publishPauseIndefinite: indefinite, publishPauseReason: reason, publishPauseSeen: false },
  });
  const note = indefinite ? "jusqu'à nouvel ordre" : `jusqu'au ${formatPauseEnd(until!, "fr")}`;
  await logModeration({ moderatorId: admin.id, action: "PUBLISH_PAUSE", targetType: "user", targetId: user.id, label: user.username, note: reason ? `${note} · ${reason}` : note });
  refreshSite();
}

export async function resumePublishing(formData: FormData) {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: String(formData.get("userId")) }, select: { id: true, username: true, publishPausedUntil: true, publishPauseIndefinite: true } });
  if (!user || (!user.publishPausedUntil && !user.publishPauseIndefinite)) return;
  await db.user.update({ where: { id: user.id }, data: { publishPausedUntil: null, publishPauseIndefinite: false, publishPauseReason: null, publishPauseSeen: true } });
  await logModeration({ moderatorId: admin.id, action: "PUBLISH_RESUME", targetType: "user", targetId: user.id, label: user.username });
  refreshSite();
}

// Délai entre deux publications propre à un membre (vide = délai global, 0 = aucun délai)
export async function setMemberCooldown(formData: FormData) {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: String(formData.get("userId")) }, select: { id: true, username: true } });
  if (!user) return;
  const raw = String(formData.get("hours") ?? "").trim();
  const hours = raw === "" ? null : Math.max(0, Math.min(MAX_COOLDOWN_HOURS, Math.round(Number(raw))));
  if (hours !== null && !Number.isFinite(hours)) return;
  await db.user.update({ where: { id: user.id }, data: { publishCooldownHours: hours } });
  await logModeration({ moderatorId: admin.id, action: "PUBLISH_COOLDOWN", targetType: "user", targetId: user.id, label: user.username, note: hours === null ? "délai global" : `${hours} h` });
  refreshSite();
}

// Délai entre deux publications pour tous les vendeurs (0 = aucun)
export async function setGlobalCooldown(formData: FormData) {
  const admin = await requireAdmin();
  const hours = Number(String(formData.get("hours") ?? "").trim() || "0");
  if (!Number.isFinite(hours) || hours < 0) return;
  await setGlobalCooldownHours(hours);
  await logModeration({ moderatorId: admin.id, action: "PUBLISH_COOLDOWN", targetType: "site", targetId: "global", label: "Tous les vendeurs", note: `${Math.round(hours)} h` });
  refreshSite();
}

// Nommer un membre modérateur, ou lui retirer ce rôle (seulement le propriétaire du site, jamais sur lui-même)
export async function setModerator(formData: FormData) {
  const admin = await requireAdmin();
  const ownerId = await siteOwnerId();
  if (admin.id !== ownerId) return;
  const user = await db.user.findUnique({ where: { id: String(formData.get("userId")) }, select: { id: true, username: true, role: true, bannedAt: true } });
  if (!user || user.id === ownerId) return;
  const makeModerator = formData.get("make") === "1";
  if (makeModerator === (user.role === "ADMIN") || (makeModerator && user.bannedAt)) return;
  await db.user.update({ where: { id: user.id }, data: { role: makeModerator ? "ADMIN" : "USER" } });
  await logModeration({ moderatorId: admin.id, action: makeModerator ? "ROLE_GRANT" : "ROLE_REVOKE", targetType: "user", targetId: user.id, label: user.username });
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
  const resources = await db.resource.findMany({ where: { id: { in: pickedIds(target, formData) }, status: "APPROVED" }, select: { id: true, slug: true, title: true, sellerId: true } });
  await db.resource.updateMany({ where: { id: { in: resources.map((r) => r.id) } }, data: { status: "UNLISTED" } });
  for (const r of resources) {
    await logModeration({ moderatorId: admin.id, action: "UNLIST", targetType: "resource", targetId: r.id, label: r.title });
    await notify(r.sellerId, "RES_UNLISTED", { title: r.title }, links.report(r.id));
  }
  refreshResources(resources.map((r) => r.slug));
}

// Mettre en ligne une ressource refusée ou en vérification (comme « Approuver » dans À vérifier) :
// sa version actuelle passe en ligne, badge « Contenu vérifié » si l'IA n'a rien signalé, vendeur prévenu
export async function adminApprove(target: string | null, formData: FormData) {
  const admin = await requireAdmin();
  const resources = await db.resource.findMany({
    where: { id: { in: pickedIds(target, formData) }, status: { in: ["REJECTED", "PENDING"] } },
    select: { id: true, slug: true, title: true, sellerId: true, version: true },
  });
  for (const r of resources) {
    const live = await db.resourceVersion.findUnique({ where: { resourceId_version: { resourceId: r.id, version: r.version } } });
    await db.$transaction([
      db.resource.update({ where: { id: r.id }, data: { status: "APPROVED", reviewNote: null, aiVerified: live?.aiStatus === "DONE" && live.aiFlagged === false } }),
      ...(live ? [db.resourceVersion.update({ where: { id: live.id }, data: { status: "LIVE", reviewNote: null, aiReviewed: true } })] : []),
    ]);
    await grantFounderIfEligible(r.sellerId);
    await logModeration({ moderatorId: admin.id, action: "APPROVE", targetType: "resource", targetId: r.id, label: r.title });
    await notify(r.sellerId, "RES_APPROVED", { title: r.title }, links.resource(r.slug));
  }
  refreshResources(resources.map((r) => r.slug));
}

// Remettre en vente une ressource retirée
export async function adminRelist(target: string | null, formData: FormData) {
  const admin = await requireAdmin();
  const resources = await db.resource.findMany({ where: { id: { in: pickedIds(target, formData) }, status: "UNLISTED" }, select: { id: true, slug: true, title: true, sellerId: true } });
  await db.resource.updateMany({ where: { id: { in: resources.map((r) => r.id) } }, data: { status: "APPROVED", unlistedByBan: false } });
  for (const r of resources) {
    await logModeration({ moderatorId: admin.id, action: "RELIST", targetType: "resource", targetId: r.id, label: r.title });
    await notify(r.sellerId, "RES_RELISTED", { title: r.title }, links.resource(r.slug));
  }
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

// Arrêter les réanalyses IA des ressources déjà en ligne (les nouvelles publications restent dans la file)
// Compresse les anciennes images (environ 1 min par clic ; recliquer s'il en reste)
export async function adminCompressImages() {
  await requireAdmin();
  await compressStoredImages(80_000);
  revalidatePath("/", "layout");
}

export async function adminStopLiveReanalyses() {
  await requireAdmin();
  await stopLiveReanalyses();
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
  await notify(resource.sellerId, "RES_DELETED", { title: resource.title }, null);
  refreshResources([resource.slug]);
}
