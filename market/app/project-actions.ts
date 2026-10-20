"use server";

// Projets sur mesure (voir lib/projects.ts) : demandes des clients, offres des développeurs, paiement,
// conversation du projet, livraison, validation, litige et décision de la modération. Elles s'exécutent sur le serveur.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, requireAdmin, requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { CATEGORIES } from "@/lib/catalog";
import { isDemoMode } from "@/lib/payments";
import { receiveUpload } from "@/lib/uploads";
import { scanUpload } from "@/lib/scan";
import { mentionsOffPlatform, MESSAGE_MAX_LENGTH } from "@/lib/chat-text";
import { logModeration } from "@/lib/moderation";
import { notify, notifyAdmins } from "@/lib/notifications";
import {
  autoReleaseDate,
  createProjectCheckout,
  fakePayProject,
  notifyProject,
  PROJECT_MAX_CENTS,
  PROJECT_MAX_DAYS,
  PROJECT_MIN_CENTS,
  projectLinks,
  projectRole,
  refundProject,
  releaseProject,
  systemMessage,
} from "@/lib/projects";

export type ProjectFormState = { error?: string; ok?: boolean } | undefined;

const euros = (value: FormDataEntryValue | null) => Math.round(Number(String(value ?? "").replace(",", ".")) * 100);
const text = (value: FormDataEntryValue | null, max: number) => String(value ?? "").trim().slice(0, max);

function refreshProject(projectId: string, requestId?: string) {
  revalidatePath(projectLinks.work(projectId));
  if (requestId) revalidatePath(projectLinks.request(requestId));
  revalidatePath("/projects");
  revalidatePath("/dashboard/projects");
  revalidatePath("/admin", "layout");
}

// ---------- Demandes ----------

export async function createProjectRequest(_: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const user = await requireUser("/projects/new");
  const { t } = await getDictionary();
  const e = t.projects.errors;
  const title = text(formData.get("title"), 90);
  const description = text(formData.get("description"), 5000);
  const category = String(formData.get("category") ?? "");
  const budgetCents = euros(formData.get("budget"));
  const deadline = Number(formData.get("deadline") || 0);
  if (title.length < 6) return { error: e.title };
  if (description.length < 40) return { error: e.description };
  if (!CATEGORIES.some((c) => c.id === category)) return { error: e.category };
  if (!Number.isFinite(budgetCents) || budgetCents < PROJECT_MIN_CENTS || budgetCents > PROJECT_MAX_CENTS) return { error: e.budget };
  if (deadline && (!Number.isInteger(deadline) || deadline < 1 || deadline > PROJECT_MAX_DAYS)) return { error: e.days };
  // Anti-spam : 5 demandes ouvertes au plus par membre
  const open = await db.projectRequest.count({ where: { clientId: user.id, status: { in: ["OPEN", "ASSIGNED"] } } });
  if (open >= 5) return { error: e.tooMany };
  const request = await db.projectRequest.create({ data: { clientId: user.id, title, description, category, budgetCents, deadlineDays: deadline || null } });
  revalidatePath("/projects");
  redirect(projectLinks.request(request.id));
}

export async function cancelProjectRequest(formData: FormData) {
  const user = await requireUser();
  const request = await db.projectRequest.findUnique({ where: { id: String(formData.get("requestId")) }, select: { id: true, clientId: true, status: true } });
  if (!request || request.clientId !== user.id || request.status !== "OPEN") return;
  await db.$transaction([
    db.projectRequest.update({ where: { id: request.id }, data: { status: "CANCELED" } }),
    db.projectOffer.updateMany({ where: { requestId: request.id, status: "PENDING" }, data: { status: "DECLINED" } }),
  ]);
  revalidatePath(projectLinks.request(request.id));
  revalidatePath("/projects");
}

// ---------- Offres ----------

export async function submitProjectOffer(_: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const e = t.projects.errors;
  const request = await db.projectRequest.findUnique({ where: { id: String(formData.get("requestId")) }, select: { id: true, clientId: true, status: true, title: true } });
  if (!request || request.status !== "OPEN") return { error: e.closed };
  if (request.clientId === user.id) return { error: e.ownRequest };
  const priceCents = euros(formData.get("price"));
  const days = Number(formData.get("days"));
  const message = text(formData.get("message"), 3000);
  if (!Number.isFinite(priceCents) || priceCents < PROJECT_MIN_CENTS || priceCents > PROJECT_MAX_CENTS) return { error: e.budget };
  if (!Number.isInteger(days) || days < 1 || days > PROJECT_MAX_DAYS) return { error: e.days };
  if (message.length < 20) return { error: e.offerMessage };
  const existing = await db.projectOffer.findUnique({ where: { requestId_devId: { requestId: request.id, devId: user.id } } });
  if (existing && existing.status !== "PENDING" && existing.status !== "WITHDRAWN") return { error: e.closed };
  await db.projectOffer.upsert({
    where: { requestId_devId: { requestId: request.id, devId: user.id } },
    create: { requestId: request.id, devId: user.id, priceCents, days, message },
    update: { priceCents, days, message, status: "PENDING" },
  });
  // Le client est prévenu à la première offre de ce développeur (pas à chaque modification)
  if (!existing || existing.status === "WITHDRAWN") {
    await notify(request.clientId, "PROJECT_OFFER", { title: request.title, user: user.username, amount: priceCents }, projectLinks.request(request.id));
  }
  revalidatePath(projectLinks.request(request.id));
  return { ok: true };
}

export async function withdrawProjectOffer(formData: FormData) {
  const user = await requireUser();
  const offer = await db.projectOffer.findUnique({ where: { id: String(formData.get("offerId")) }, select: { id: true, devId: true, status: true, requestId: true } });
  if (!offer || offer.devId !== user.id || offer.status !== "PENDING") return;
  await db.projectOffer.update({ where: { id: offer.id }, data: { status: "WITHDRAWN" } });
  revalidatePath(projectLinks.request(offer.requestId));
}

// Le client choisit une offre : le projet est créé, en attente de son paiement
export async function acceptProjectOffer(formData: FormData) {
  const user = await requireUser();
  const offer = await db.projectOffer.findUnique({
    where: { id: String(formData.get("offerId")) },
    include: { request: { select: { id: true, clientId: true, status: true, title: true } }, dev: { select: { bannedAt: true } } },
  });
  if (!offer || offer.request.clientId !== user.id || offer.request.status !== "OPEN" || offer.status !== "PENDING" || offer.dev.bannedAt) return;
  const project = await db.$transaction(async (tx) => {
    const { count } = await tx.projectRequest.updateMany({ where: { id: offer.requestId, status: "OPEN" }, data: { status: "ASSIGNED" } });
    if (count !== 1) return null;
    await tx.projectOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED" } });
    await tx.projectOffer.updateMany({ where: { requestId: offer.requestId, id: { not: offer.id }, status: "PENDING" }, data: { status: "DECLINED" } });
    return tx.project.create({
      data: { requestId: offer.requestId, offerId: offer.id, clientId: user.id, devId: offer.devId, title: offer.request.title, priceCents: offer.priceCents, days: offer.days },
    });
  });
  if (!project) return;
  await notifyProject(project.id, "dev", "PROJECT_CHOSEN", user.username);
  refreshProject(project.id, offer.requestId);
  redirect(projectLinks.work(project.id));
}

// ---------- Paiement ----------

export async function payProject(formData: FormData) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) } });
  if (!project || project.clientId !== user.id || project.status !== "AWAITING_PAYMENT") return;
  if (isDemoMode) {
    await fakePayProject(project.id, project.priceCents);
    refreshProject(project.id);
    redirect(projectLinks.work(project.id));
  }
  const { t } = await getDictionary();
  const session = await createProjectCheckout(project, user.email, t.resource.serviceFeeLine);
  await db.project.update({ where: { id: project.id }, data: { stripeSessionId: session.id } });
  redirect(session.url!);
}

// Avant le paiement, le client ou le développeur peut annuler : la demande repart et peut recevoir d'autres offres
export async function cancelUnpaidProject(formData: FormData) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) } });
  const role = project && projectRole(project, user);
  if (!project || (role !== "client" && role !== "dev") || project.status !== "AWAITING_PAYMENT") return;
  await db.$transaction(async (tx) => {
    const { count } = await tx.project.updateMany({ where: { id: project.id, status: "AWAITING_PAYMENT" }, data: { status: "CANCELED" } });
    if (count !== 1) return;
    await tx.projectRequest.update({ where: { id: project.requestId }, data: { status: "OPEN" } });
    await tx.projectOffer.update({ where: { id: project.offerId }, data: { status: role === "dev" ? "WITHDRAWN" : "DECLINED" } });
    await tx.projectOffer.updateMany({ where: { requestId: project.requestId, id: { not: project.offerId }, status: "DECLINED" }, data: { status: "PENDING" } });
    await systemMessage(tx, project.id, "CANCELED");
  });
  await notifyProject(project.id, role === "client" ? "dev" : "client", "PROJECT_CANCELED", user.username);
  refreshProject(project.id, project.requestId);
  redirect(projectLinks.request(project.requestId));
}

// ---------- Conversation du projet ----------

export async function sendProjectMessage(_: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) } });
  const role = project && projectRole(project, user);
  if (!project || !role) return { error: t.projects.errors.notAllowed };
  if (project.status === "CANCELED") return { error: t.projects.errors.closed };
  const body = text(formData.get("body"), MESSAGE_MAX_LENGTH);
  if (!body) return { error: t.projects.errors.emptyMessage };
  await db.projectMessage.create({ data: { projectId: project.id, senderId: user.id, body, offPlatform: mentionsOffPlatform(body) } });
  await db.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });
  // L'autre partie est prévenue (une seule notification non lue par projet)
  const others = role === "client" ? [project.devId] : role === "dev" ? [project.clientId] : [project.clientId, project.devId];
  for (const other of others) {
    const unread = await db.notification.count({ where: { userId: other, type: "PROJECT_MESSAGE", link: projectLinks.work(project.id), readAt: null } });
    if (!unread) await notify(other, "PROJECT_MESSAGE", { title: project.title, user: role === "admin" ? t.projects.moderation : user.username }, projectLinks.work(project.id));
  }
  revalidatePath(projectLinks.work(project.id));
  return { ok: true };
}

// ---------- Livraison et validation ----------

export async function deliverProject(_: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const user = await requireUser();
  const { t } = await getDictionary();
  const e = t.projects.errors;
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) } });
  if (!project || project.devId !== user.id) return { error: e.notAllowed };
  if (project.status !== "IN_PROGRESS") return { error: e.closed };
  const file = await receiveUpload(formData, t);
  if ("error" in file) return { error: file.error };
  // Scan anti-backdoor, comme pour les ressources : un fichier dangereux n'est pas livré
  let verdict: string;
  try {
    verdict = scanUpload(file.bytes, file.fileName).verdict;
  } catch (err) {
    return { error: t.errors.fileUnreadable((err as Error).message) };
  }
  if (verdict === "dangerous") return { error: e.dangerous };
  const note = text(formData.get("note"), MESSAGE_MAX_LENGTH);
  const now = new Date();
  await db.$transaction(async (tx) => {
    const { count } = await tx.project.updateMany({ where: { id: project.id, status: "IN_PROGRESS" }, data: { status: "DELIVERED", deliveredAt: now, autoReleaseAt: autoReleaseDate(now) } });
    if (count !== 1) return;
    await tx.projectMessage.create({
      data: { projectId: project.id, senderId: user.id, kind: "DELIVERY", body: note, fileName: file.fileName, filePath: file.filePath, fileSize: file.fileSize, scanVerdict: verdict, offPlatform: mentionsOffPlatform(note) },
    });
  });
  await notifyProject(project.id, "client", "PROJECT_DELIVERED", user.username);
  refreshProject(project.id);
  return { ok: true };
}

export async function acceptProjectDelivery(formData: FormData) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) }, select: { id: true, clientId: true, status: true } });
  if (!project || project.clientId !== user.id || project.status !== "DELIVERED") return;
  await releaseProject(project.id, "client");
  refreshProject(project.id);
}

export async function requestProjectRevision(formData: FormData) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) }, select: { id: true, clientId: true, status: true } });
  if (!project || project.clientId !== user.id || project.status !== "DELIVERED") return;
  const note = text(formData.get("note"), MESSAGE_MAX_LENGTH);
  await db.$transaction(async (tx) => {
    const { count } = await tx.project.updateMany({ where: { id: project.id, status: "DELIVERED" }, data: { status: "IN_PROGRESS", autoReleaseAt: null } });
    if (count === 1) await systemMessage(tx, project.id, "REVISION", note);
  });
  await notifyProject(project.id, "dev", "PROJECT_REVISION", user.username);
  refreshProject(project.id);
}

// Le développeur abandonne le projet : le client est remboursé et la demande repart
export async function abandonProject(formData: FormData) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) }, select: { id: true, devId: true, requestId: true } });
  if (!project || project.devId !== user.id) return;
  await refundProject(project.id, "dev", text(formData.get("note"), 500));
  refreshProject(project.id, project.requestId);
}

// ---------- Litige ----------

export async function openProjectDispute(formData: FormData) {
  const user = await requireUser();
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) } });
  const role = project && projectRole(project, user);
  if (!project || (role !== "client" && role !== "dev") || !["IN_PROGRESS", "DELIVERED"].includes(project.status)) return;
  const reason = text(formData.get("reason"), 1000);
  if (reason.length < 10) return;
  await db.$transaction(async (tx) => {
    const { count } = await tx.project.updateMany({
      where: { id: project.id, status: { in: ["IN_PROGRESS", "DELIVERED"] } },
      data: { status: "DISPUTED", disputedAt: new Date(), disputeReason: reason, disputeById: user.id, autoReleaseAt: null },
    });
    if (count === 1) await systemMessage(tx, project.id, "DISPUTED", reason);
  });
  await notifyProject(project.id, role === "client" ? "dev" : "client", "PROJECT_DISPUTE", user.username);
  await notifyAdmins("MOD_PROJECT", { title: project.title, user: user.username }, projectLinks.work(project.id));
  refreshProject(project.id);
}

// Décision de la modération : payer le développeur ou rembourser le client
export async function resolveProjectDispute(formData: FormData) {
  const admin = await requireAdmin();
  const project = await db.project.findUnique({ where: { id: String(formData.get("projectId")) }, select: { id: true, title: true, status: true } });
  if (!project || project.status !== "DISPUTED") return;
  const decision = String(formData.get("decision"));
  const note = text(formData.get("note"), 500);
  const done = decision === "release" ? await releaseProject(project.id, "admin", note) : decision === "refund" ? await refundProject(project.id, "admin", note) : false;
  if (done) await logModeration({ moderatorId: admin.id, action: decision === "release" ? "PROJECT_RELEASE" : "PROJECT_REFUND", targetType: "project", targetId: project.id, label: project.title, note: note || null });
  refreshProject(project.id);
}

// Lecture de la conversation (rafraîchissement automatique de la page du projet)
export async function projectStatus(projectId: string) {
  const user = await getCurrentUser();
  const project = await db.project.findUnique({ where: { id: projectId }, select: { clientId: true, devId: true, status: true, updatedAt: true, _count: { select: { messages: true } } } });
  if (!project || !projectRole(project, user)) return null;
  return `${project.status}:${project._count.messages}:${project.updatedAt.getTime()}`;
}
