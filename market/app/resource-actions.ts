"use server";

// Actions de la page « Modifier une ressource » (Mon espace → Mes ressources → Modifier)
// et modération des nouvelles versions. Elles s'exécutent sur le serveur.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/auth";
import { hasRobloxContent, scanUpload, type ScanReport } from "@/lib/scan";
import { isUploadedImage, receiveUpload } from "@/lib/uploads";
import { grantFounderIfEligible } from "@/lib/sellers";
import { detectImage, saveImage } from "@/lib/storage";
import { CATEGORIES, MAX_IMAGE_SIZE, MAX_IMAGES } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { isValidVersion, promoteVersion } from "@/lib/versions";
import { enqueueAnalysis, findUnanalyzedVersionIds, kickAiQueue } from "@/lib/ai/run";
import { logModeration } from "@/lib/moderation";

// Résultat d'un enregistrement : une erreur à afficher, ou un message de réussite
export type EditState = { error?: string; ok?: string } | undefined;

// La ressource doit appartenir au vendeur connecté
async function ownResource(resourceId: string) {
  const user = await requireUser();
  const resource = await db.resource.findUnique({ where: { id: resourceId } });
  if (!resource || resource.sellerId !== user.id) return null;
  return resource;
}

// Le texte d'une ressource en ligne a changé : l'IA revérifie que le contenu correspond (file d'attente).
// Le résultat met à jour le badge « Contenu vérifié » ; un signalement apparaît dans la modération.
async function reanalyzeLiveVersion(resource: { id: string; status: string; version: string }, locale: "fr" | "en") {
  if (resource.status !== "APPROVED" && resource.status !== "UNLISTED") return;
  const live = await db.resourceVersion.findUnique({ where: { resourceId_version: { resourceId: resource.id, version: resource.version } } });
  // Seulement si le fichier contient du contenu Roblox (l'IA ne peut pas analyser une image ou un son)
  if (!live || !hasRobloxContent(JSON.parse(live.scanReport) as ScanReport)) return;
  await enqueueAnalysis(live.id, locale);
  kickAiQueue();
}

function refresh(resource: { id: string; slug: string }) {
  revalidatePath(`/dashboard/resources/${resource.id}/edit`);
  revalidatePath(`/resources/${resource.slug}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/");
}

// ---------- Infos, description, prix, images (visibles tout de suite, sans nouveau scan) ----------

export async function updateResourceInfo(_: EditState, formData: FormData): Promise<EditState> {
  const { locale, t } = await getDictionary();
  const resource = await ownResource(String(formData.get("resourceId")));
  if (!resource) return { error: t.errors.notFound };
  const parsed = z
    .object({
      title: z.string().trim().min(4, t.errors.titleMin).max(80, t.errors.titleMax),
      summary: z.string().trim().min(10, t.errors.summaryMin).max(160, t.errors.summaryMax),
      category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]], { message: t.errors.category }),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // Le lien de la page (slug) ne change pas : les liens partagés continuent de marcher
  await db.resource.update({ where: { id: resource.id }, data: parsed.data });
  await reanalyzeLiveVersion(resource, locale);
  refresh(resource);
  return { ok: t.edit.saved };
}

export async function updateResourceDescription(_: EditState, formData: FormData): Promise<EditState> {
  const { locale, t } = await getDictionary();
  const resource = await ownResource(String(formData.get("resourceId")));
  if (!resource) return { error: t.errors.notFound };
  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 30) return { error: t.errors.descriptionMin };
  if (description.length > 10000) return { error: t.errors.descriptionMin };
  await db.resource.update({ where: { id: resource.id }, data: { description } });
  await reanalyzeLiveVersion(resource, locale);
  refresh(resource);
  return { ok: t.edit.saved };
}

export async function updateResourcePrice(_: EditState, formData: FormData): Promise<EditState> {
  const { t } = await getDictionary();
  const resource = await ownResource(String(formData.get("resourceId")));
  if (!resource) return { error: t.errors.notFound };
  const price = Number(formData.get("price"));
  if (!Number.isFinite(price) || price < 0) return { error: t.errors.price };
  if (price > 500) return { error: t.errors.priceMax };
  const priceCents = Math.round(price * 100);
  if (priceCents > 0 && priceCents < 100) return { error: t.errors.priceMin };
  // Le nouveau prix ne s'applique qu'aux prochains achats : les acheteurs gardent leur accès
  await db.resource.update({ where: { id: resource.id }, data: { priceCents } });
  refresh(resource);
  return { ok: t.edit.saved };
}

// Images : « order » liste les images dans l'ordre voulu, soit une adresse déjà enregistrée, soit « new:N »
// pour la N-ième nouvelle image envoyée dans « images »
export async function updateResourceImages(_: EditState, formData: FormData): Promise<EditState> {
  const { t } = await getDictionary();
  const resource = await ownResource(String(formData.get("resourceId")));
  if (!resource) return { error: t.errors.notFound };

  let order: string[];
  try {
    order = z.array(z.string()).max(MAX_IMAGES).parse(JSON.parse(String(formData.get("order") ?? "[]")));
  } catch {
    return { error: t.errors.tooManyImages(MAX_IMAGES) };
  }
  const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  const urls: string[] = [];
  for (const entry of order) {
    if (entry.startsWith("new:")) {
      const file = files[Number(entry.slice(4))];
      if (!file) continue;
      if (file.size > MAX_IMAGE_SIZE) return { error: t.errors.imageTooBig };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = detectImage(bytes);
      if (!ext) return { error: t.errors.imageFormat };
      urls.push(await saveImage(bytes, ext));
    } else if (entry.startsWith("url:")) {
      // Image envoyée directement dans le stockage (jusqu'à 20 Mo)
      const url = entry.slice(4);
      if (!(await isUploadedImage(url))) return { error: t.errors.imageTooBig };
      urls.push(url);
    } else if (resource.images.includes(entry)) {
      // Seulement des images qui appartiennent déjà à cette ressource
      urls.push(entry);
    }
  }
  await db.resource.update({ where: { id: resource.id }, data: { images: urls } });
  refresh(resource);
  return { ok: t.edit.saved };
}

// ---------- Nouvelle version (nouveau fichier, scanné comme une publication) ----------

export async function publishVersion(_: EditState, formData: FormData): Promise<EditState> {
  const { locale, t } = await getDictionary();
  const resource = await ownResource(String(formData.get("resourceId")));
  if (!resource) return { error: t.errors.notFound };

  const version = String(formData.get("version") ?? "").trim();
  if (!isValidVersion(version)) return { error: t.edit.versionInvalid };
  if (await db.resourceVersion.findUnique({ where: { resourceId_version: { resourceId: resource.id, version } } })) {
    return { error: t.edit.versionTaken(version) };
  }
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 1000) || null;

  // Le fichier (envoyé directement dans le stockage, voir lib/uploads.ts), puis le scan, comme à la publication
  const file = await receiveUpload(formData, t);
  if ("error" in file) return { error: file.error };
  let report;
  try {
    report = scanUpload(file.bytes, file.fileName);
  } catch (err) {
    return { error: t.errors.fileUnreadable((err as Error).message) };
  }
  const fileData = {
    resourceId: resource.id,
    version,
    notes,
    fileName: file.fileName,
    filePath: file.filePath,
    fileSize: file.fileSize,
    scanVerdict: report.verdict,
    scanScore: report.score,
    scanReport: JSON.stringify(report),
  };

  // Dangereuse : refusée, rien ne change pour les acheteurs
  if (report.verdict === "dangerous") {
    await db.resourceVersion.create({ data: { ...fileData, status: "REJECTED", reviewNote: t.errors.autoReject } });
    refresh(resource);
    return { error: t.edit.versionRejected(version) };
  }

  const live = resource.status === "APPROVED" || resource.status === "UNLISTED";
  const clean = report.verdict === "clean";

  // Propre et sans contenu Roblox (image, son, modèle 3D…) : l'IA ne peut rien analyser, la version passe en ligne
  if (clean && !hasRobloxContent(report)) {
    await db.$transaction(async (tx) => {
      const created = await tx.resourceVersion.create({ data: { ...fileData, status: "ANALYZING" } });
      await promoteVersion(tx, created.id, live);
      if (!live) await tx.resource.update({ where: { id: resource.id }, data: { status: "APPROVED", reviewNote: null } });
    });
    if (!live) await grantFounderIfEligible(resource.sellerId);
    refresh(resource);
    revalidatePath("/admin", "layout");
    return { ok: t.edit.versionLive(version) };
  }

  const created = await db.$transaction(async (tx) => {
    // Propre : analyse IA d'abord (« ANALYZING »), puis en ligne ou en modération (voir lib/ai/run.ts).
    // À vérifier : attend un modérateur. Dans les deux cas, la version en ligne reste téléchargeable.
    const created = await tx.resourceVersion.create({ data: { ...fileData, status: clean ? "ANALYZING" : "PENDING" } });
    if (!live) {
      // Ressource pas encore en ligne (en vérification ou refusée) : la nouvelle version la remplace
      await tx.resourceVersion.updateMany({
        where: { resourceId: resource.id, id: { not: created.id }, status: { in: ["PENDING", "ANALYZING"] } },
        data: { status: "OLD" },
      });
      await tx.resource.update({
        where: { id: resource.id },
        data: {
          status: clean ? "ANALYZING" : "PENDING",
          reviewNote: null,
          aiVerified: false,
          version,
          fileName: fileData.fileName,
          filePath: fileData.filePath,
          fileSize: fileData.fileSize,
          scanVerdict: fileData.scanVerdict,
          scanScore: fileData.scanScore,
          scanReport: fileData.scanReport,
        },
      });
    }
    return created;
  });

  // Analyse IA dans la file d'attente : le vendeur n'attend pas (sa place s'affiche dans Mon espace)
  if (hasRobloxContent(report)) {
    await enqueueAnalysis(created.id, locale);
    kickAiQueue();
  }

  refresh(resource);
  revalidatePath("/admin", "layout");
  return { ok: clean ? t.edit.versionAnalyzing(version) : t.edit.versionPending(version) };
}

// ---------- Modération d'une nouvelle version (admins) ----------

export async function moderateVersion(formData: FormData) {
  const admin = await requireAdmin();
  const versionId = String(formData.get("versionId"));
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") ?? "").trim() || null;

  const version = await db.resourceVersion.findUnique({ where: { id: versionId }, include: { resource: true } });
  if (!version || version.status !== "PENDING") return;

  if (approve) {
    await db.resourceVersion.update({ where: { id: version.id }, data: { aiReviewed: true } });
    await db.$transaction((tx) => promoteVersion(tx, version.id, true));
  } else {
    await db.resourceVersion.update({ where: { id: version.id }, data: { status: "REJECTED", reviewNote: note, aiReviewed: true } });
  }
  await logModeration({ moderatorId: admin.id, action: approve ? "APPROVE" : "REJECT", targetType: "version", targetId: version.id, label: `${version.resource.title} v${version.version}`, note });
  refresh(version.resource);
  revalidatePath("/admin", "layout");
}

// ---------- Analyse IA : signalements de ressources en ligne et analyse des anciennes ressources (admins) ----------

// Ressource en ligne signalée par l'IA : « C'est bon » (on garde) ou « Retirer de la vente »
// (les acheteurs gardent leur téléchargement)
export async function reviewAiFlag(formData: FormData) {
  const admin = await requireAdmin();
  const versionId = String(formData.get("versionId"));
  const unlist = formData.get("decision") === "unlist";
  const note = String(formData.get("note") ?? "").trim() || null;
  const version = await db.resourceVersion.update({ where: { id: versionId }, data: { aiReviewed: true }, include: { resource: true } });
  if (unlist && version.resource.status === "APPROVED") {
    await db.resource.update({ where: { id: version.resourceId }, data: { status: "UNLISTED", reviewNote: note } });
  }
  await logModeration({ moderatorId: admin.id, action: unlist ? "UNLIST" : "KEEP", targetType: "resource", targetId: version.resourceId, label: version.resource.title, note });
  refresh(version.resource);
  revalidatePath("/admin", "layout");
}

// Toutes les anciennes ressources (et les analyses impossibles) rejoignent la file d'attente
export async function analyzeExistingResources() {
  await requireAdmin();
  const { locale } = await getDictionary();
  await enqueueAnalysis(await findUnanalyzedVersionIds(), locale);
  kickAiQueue();
  revalidatePath("/admin", "layout");
}
