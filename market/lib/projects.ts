import "server-only";
import type Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { BUYER_FEE_KIND, stripe, TAX_CODE } from "./payments";
import { buyerFeeCents } from "./buyer-fee";
import { splitSale } from "./earnings";
import { notify, notifyAdmins } from "./notifications";

// Projets sur mesure.
// 1. Un client publie une demande (titre, description, catégorie, budget de 5 à 500 €, délai souhaité).
// 2. Des développeurs proposent un prix et un délai. Le client en choisit un : le projet est créé.
// 3. Le client paie Qubik (prix + frais de service, comme pour une ressource). Qubik garde l'argent.
// 4. Le développeur livre un fichier (scanné comme les ressources). Le client valide, demande des modifications
//    ou ouvre un litige. Sans réponse 7 jours après la livraison, le projet est validé automatiquement.
// 5. Validé : le développeur reçoit un gain (prix − TVA − 10 % de commission), versé avec les versements
//    hebdomadaires habituels (lib/payouts.ts). Litige : la modération paie le développeur ou rembourse le client.

export const PROJECT_FEE_PERCENT = 10; // commission de Qubik sur le prix hors TVA (le client paie aussi les frais de service)
export const AUTO_RELEASE_DAYS = 7;
export const PROJECT_MIN_CENTS = 500;
export const PROJECT_MAX_CENTS = 50_000;
export const PROJECT_MAX_DAYS = 90;
const DAY = 24 * 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;

export const projectLinks = {
  request: (id: string) => `/projects/${id}`,
  work: (id: string) => `/projects/work/${id}`,
  admin: "/admin/projects",
};

// Rôle d'un membre dans un projet (null : aucun accès)
export function projectRole(project: { clientId: string; devId: string }, user: { id: string; role: string } | null) {
  if (!user) return null;
  if (user.id === project.clientId) return "client" as const;
  if (user.id === project.devId) return "dev" as const;
  if (user.role === "ADMIN") return "admin" as const;
  return null;
}

// Message automatique dans la conversation du projet (le texte est écrit à l'affichage, dans la langue du lecteur)
export async function systemMessage(client: Tx | typeof db, projectId: string, event: string, body = "") {
  await client.projectMessage.create({ data: { projectId, kind: "SYSTEM", event, body: body.slice(0, 1000) } });
}

// ---------- Paiement ----------

// Session de paiement Stripe du projet (prix de l'offre + frais de service, TVA comprise, comme une ressource)
export async function createProjectCheckout(project: { id: string; title: string; priceCents: number }, email: string, feeLabel: string) {
  if (!stripe) throw new Error("Stripe n'est pas configuré");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const disableManagedPayments = { managed_payments: { enabled: false } } as Partial<Stripe.Checkout.SessionCreateParams>;
  return stripe.checkout.sessions.create({
    ...disableManagedPayments,
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "eur", unit_amount: project.priceCents, tax_behavior: "inclusive", product_data: { name: project.title, tax_code: TAX_CODE } },
      },
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: buyerFeeCents(project.priceCents),
          tax_behavior: "inclusive",
          product_data: { name: feeLabel, tax_code: TAX_CODE, metadata: { kind: BUYER_FEE_KIND } },
        },
      },
    ],
    automatic_tax: { enabled: true, liability: { type: "self" } },
    customer_email: email,
    metadata: { projectId: project.id },
    payment_intent_data: { metadata: { projectId: project.id } },
    success_url: `${appUrl}${projectLinks.work(project.id)}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}${projectLinks.work(project.id)}`,
  });
}

// Paiement terminé (webhook Stripe ou retour du client) : le projet démarre. Sans effet s'il est déjà enregistré.
export async function fulfillProjectSession(session: Stripe.Checkout.Session) {
  const projectId = session.metadata?.projectId;
  if (!projectId || session.payment_status !== "paid" || !stripe) return;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const lines = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price.product"] });
  const feeLine = lines.data.find((l) => {
    const product = l.price?.product;
    return typeof product === "object" && product !== null && !product.deleted && product.metadata?.kind === BUYER_FEE_KIND;
  });
  const started = await db.$transaction(async (tx) => {
    const { count } = await tx.project.updateMany({
      where: { id: projectId, status: "AWAITING_PAYMENT" },
      data: {
        status: "IN_PROGRESS",
        paidAt: new Date(),
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        amountCents: session.amount_total ?? 0,
        taxCents: session.total_details?.amount_tax ?? 0,
        buyerFeeCents: feeLine?.amount_total ?? 0,
        buyerFeeTaxCents: feeLine?.amount_tax ?? 0,
      },
    });
    if (count === 1) await systemMessage(tx, projectId, "PAID");
    return count === 1;
  });
  if (started) await notifyProject(projectId, "dev", "PROJECT_PAID");
}

// Mode démo (sans Stripe) : le paiement est simulé
export async function fakePayProject(projectId: string, priceCents: number) {
  const fee = buyerFeeCents(priceCents);
  await db.$transaction(async (tx) => {
    const { count } = await tx.project.updateMany({
      where: { id: projectId, status: "AWAITING_PAYMENT" },
      data: { status: "IN_PROGRESS", paidAt: new Date(), amountCents: priceCents + fee, buyerFeeCents: fee },
    });
    if (count === 1) await systemMessage(tx, projectId, "PAID");
  });
  await notifyProject(projectId, "dev", "PROJECT_PAID");
}

// ---------- Fin du projet ----------

// Validé (par le client, automatiquement ou par la modération) : gain du développeur, versé au prochain versement hebdomadaire
export async function releaseProject(projectId: string, how: "client" | "auto" | "admin", note = "") {
  const done = await db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true, devId: true, requestId: true, status: true, amountCents: true, taxCents: true, buyerFeeCents: true, buyerFeeTaxCents: true, earning: { select: { id: true } } } });
    const from = how === "admin" ? ["DISPUTED", "DELIVERED", "IN_PROGRESS"] : ["DELIVERED"];
    if (!project || !from.includes(project.status) || project.earning) return false;
    const { count } = await tx.project.updateMany({
      where: { id: projectId, status: project.status },
      data: { status: "COMPLETED", completedAt: new Date(), autoReleaseAt: null, ...(how === "admin" && { resolution: `RELEASED${note ? `: ${note}` : ""}` }) },
    });
    if (count !== 1) return false;
    // Le développeur est payé sur le prix du projet : les frais de service du client (et leur TVA) restent à Qubik
    const grossCents = project.amountCents - project.buyerFeeCents;
    const taxCents = project.taxCents - project.buyerFeeTaxCents;
    const { feeCents, amountCents } = splitSale(grossCents, taxCents, PROJECT_FEE_PERCENT);
    if (grossCents > 0) {
      await tx.sellerEarning.create({
        data: { sellerId: project.devId, projectId, amountCents, grossCents, taxCents, feeCents, feePercent: PROJECT_FEE_PERCENT, availableAt: new Date() },
      });
    }
    await tx.projectRequest.update({ where: { id: project.requestId }, data: { status: "CLOSED" } });
    await systemMessage(tx, projectId, how === "auto" ? "AUTO_COMPLETED" : how === "admin" ? "RELEASED" : "COMPLETED", note);
    return true;
  });
  if (done) await notifyProject(projectId, "both", "PROJECT_COMPLETED");
  return done;
}

// Remboursement complet du client (le développeur abandonne, ou décision de la modération)
export async function refundProject(projectId: string, by: "dev" | "admin", note = "") {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, status: true, requestId: true, stripePaymentIntentId: true } });
  const from = by === "admin" ? ["DISPUTED", "DELIVERED", "IN_PROGRESS"] : ["IN_PROGRESS"];
  if (!project || !from.includes(project.status)) return false;
  // Remboursement Stripe (la clé d'idempotence évite un double remboursement si l'action est relancée)
  if (stripe && project.stripePaymentIntentId) {
    await stripe.refunds.create({ payment_intent: project.stripePaymentIntentId, metadata: { projectId } }, { idempotencyKey: `qubik-project-refund-${projectId}` });
  }
  const done = await db.$transaction(async (tx) => {
    const { count } = await tx.project.updateMany({
      where: { id: projectId, status: project.status },
      data: { status: "REFUNDED", autoReleaseAt: null, ...(by === "admin" && { resolution: `REFUNDED${note ? `: ${note}` : ""}` }) },
    });
    if (count !== 1) return false;
    // Le développeur abandonne : la demande peut recevoir de nouvelles offres. Décision de la modération : terminée.
    await tx.projectRequest.update({ where: { id: project.requestId }, data: { status: by === "dev" ? "OPEN" : "CLOSED" } });
    if (by === "dev") await tx.projectOffer.updateMany({ where: { requestId: project.requestId, status: "DECLINED" }, data: { status: "PENDING" } });
    await systemMessage(tx, projectId, "REFUNDED", note);
    return true;
  });
  if (done) await notifyProject(projectId, "both", "PROJECT_REFUNDED");
  return done;
}

// Remboursement ou contestation venus de Stripe (webhook) pour un paiement de projet
export async function setProjectStatusByPaymentIntent(paymentIntentId: string, status: "REFUNDED" | "DISPUTED" | "RESTORED") {
  const project = await db.project.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, select: { id: true, status: true, earning: { select: { id: true, status: true } } } });
  if (!project) return false;
  if (status === "REFUNDED" && project.status !== "REFUNDED") {
    await db.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: { status: "REFUNDED", autoReleaseAt: null } });
      // Gain pas encore versé : annulé ; déjà versé : régularisation négative déduite du prochain versement
      if (project.earning?.status === "PENDING") await tx.sellerEarning.update({ where: { id: project.earning.id }, data: { status: "CANCELED" } });
      else if (project.earning?.status === "PAID") {
        const earning = await tx.sellerEarning.findUnique({ where: { id: project.earning.id }, include: { reversal: true } });
        if (earning && !earning.reversal) await tx.sellerEarning.create({ data: { sellerId: earning.sellerId, reversesId: earning.id, amountCents: -earning.amountCents, availableAt: new Date() } });
      }
      await systemMessage(tx, project.id, "REFUNDED");
    });
    await notifyProject(project.id, "both", "PROJECT_REFUNDED");
  } else if (status === "DISPUTED" && !["DISPUTED", "REFUNDED"].includes(project.status)) {
    await db.project.update({ where: { id: project.id }, data: { status: "DISPUTED", disputedAt: new Date(), disputeReason: "Contestation bancaire", autoReleaseAt: null } });
    await systemMessage(db, project.id, "DISPUTED", "Contestation bancaire");
    await notifyAdmins("MOD_PROJECT", { title: "Contestation bancaire" }, projectLinks.admin);
  }
  return true;
}

// Livrés depuis 7 jours sans réponse du client : validés automatiquement (appelé par la tâche quotidienne et les pages)
export async function releaseOverdueProjects() {
  const due = await db.project.findMany({ where: { status: "DELIVERED", autoReleaseAt: { lte: new Date() } }, select: { id: true }, take: 50 });
  for (const p of due) await releaseProject(p.id, "auto").catch((err) => console.error("Projet (validation automatique) :", err));
  return due.length;
}

export const autoReleaseDate = (from: Date) => new Date(from.getTime() + AUTO_RELEASE_DAYS * DAY);

// ---------- Notifications ----------

export async function notifyProject(
  projectId: string,
  to: "client" | "dev" | "both",
  type: "PROJECT_PAID" | "PROJECT_DELIVERED" | "PROJECT_REVISION" | "PROJECT_COMPLETED" | "PROJECT_DISPUTE" | "PROJECT_REFUNDED" | "PROJECT_CANCELED" | "PROJECT_CHOSEN",
  user?: string,
) {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { title: true, clientId: true, devId: true, priceCents: true } });
  if (!project) return;
  const ids = to === "both" ? [project.clientId, project.devId] : [to === "client" ? project.clientId : project.devId];
  await notify(ids, type, { title: project.title, amount: project.priceCents, user }, projectLinks.work(projectId));
}


