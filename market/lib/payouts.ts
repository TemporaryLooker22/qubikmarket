import "server-only";
import { db } from "./db";
import { stripe } from "./payments";
import { refreshTransfersStatus } from "./connect";
import { links, notify } from "./notifications";
import { siteOwnerId } from "./auth";

// Versements hebdomadaires aux vendeurs (lancés chaque lundi par une tâche Vercel, voir vercel.json).
// Pour chaque vendeur dont le compte Stripe est prêt : on additionne ses gains disponibles
// (délai de sécurité passé, régularisations négatives comprises) et on lui vire le total s'il atteint le minimum.

export const MIN_PAYOUT_CENTS = 1000; // 10 € minimum par versement (moins de frais sur les petits montants)
export const OWNER_MIN_PAYOUT_CENTS = 100; // 1 € pour le propriétaire du site (le plus ancien ADMIN)

// Minimum de versement d'un vendeur : plus bas pour le propriétaire du site
export function minPayoutCents(sellerId: string, ownerId: string | null) {
  return sellerId === ownerId ? OWNER_MIN_PAYOUT_CENTS : MIN_PAYOUT_CENTS;
}

export type Result = { sellerId: string; amountCents: number; status: "PAID" | "FAILED" | "SKIPPED"; reason?: string };

// Envoie le virement Stripe d'un versement déjà préparé en base, puis enregistre le résultat.
// La clé d'idempotence (l'id du versement) garantit qu'un même versement n'est jamais viré deux fois,
// même si la tâche est relancée après une interruption.
async function sendTransfer(payout: { id: string; sellerId: string; amountCents: number }, accountId: string, resume = false): Promise<Result> {
  try {
    // Reprise d'un versement interrompu : la clé d'idempotence ne dure que 24 h chez Stripe,
    // donc on cherche d'abord si le virement existe déjà avant d'en créer un
    const existing = resume
      ? (await stripe!.transfers.list({ destination: accountId, limit: 100 })).data.find((t) => t.metadata?.qubikPayoutId === payout.id)
      : undefined;
    const transfer = existing ?? await stripe!.transfers.create(
      {
        amount: payout.amountCents,
        currency: "eur",
        destination: accountId,
        description: "Qubik : versement de tes gains",
        metadata: { qubikPayoutId: payout.id, qubikUserId: payout.sellerId },
      },
      { idempotencyKey: `qubik-payout-${payout.id}` },
    );
    await db.$transaction([
      db.sellerPayout.update({ where: { id: payout.id }, data: { status: "PAID", transferId: transfer.id } }),
      db.sellerEarning.updateMany({ where: { payoutId: payout.id }, data: { status: "PAID", transferId: transfer.id } }),
    ]);
    await notify(payout.sellerId, "PAYOUT", { amount: payout.amountCents }, links.sales);
    return { sellerId: payout.sellerId, amountCents: payout.amountCents, status: "PAID" };
  } catch (err) {
    // Échec (solde Stripe insuffisant, compte bloqué…) : les gains repartent en attente pour le prochain passage
    const reason = (err as Error).message.slice(0, 500);
    await db.$transaction([
      db.sellerPayout.update({ where: { id: payout.id }, data: { status: "FAILED", failureReason: reason } }),
      db.sellerEarning.updateMany({ where: { payoutId: payout.id }, data: { payoutId: null } }),
    ]);
    return { sellerId: payout.sellerId, amountCents: payout.amountCents, status: "FAILED", reason };
  }
}

export async function runWeeklyPayouts(now = new Date()): Promise<Result[]> {
  if (!stripe) throw new Error("Stripe n'est pas configuré");
  const results: Result[] = [];

  // 1. Versements interrompus lors d'un passage précédent : on les termine (sans risque de double virement)
  const stuck = await db.sellerPayout.findMany({ where: { status: "PROCESSING" }, include: { seller: { select: { stripeAccountId: true } } } });
  for (const payout of stuck) {
    if (payout.seller.stripeAccountId) results.push(await sendTransfer(payout, payout.seller.stripeAccountId, true));
  }

  // 2. Nouveaux versements
  const sellers = await db.user.findMany({
    where: { stripeAccountId: { not: null }, earnings: { some: { status: "PENDING", payoutId: null, availableAt: { lte: now } } } },
    select: { id: true, stripeAccountId: true },
  });
  const ownerId = await siteOwnerId();
  for (const seller of sellers) results.push(await payoutSeller({ id: seller.id, stripeAccountId: seller.stripeAccountId! }, ownerId, now));
  return results;
}

// Versement d'un vendeur : additionne ses gains disponibles et les lui vire s'ils atteignent son minimum.
// Utilisé chaque lundi pour tous les vendeurs, et par le bouton « Encaisser maintenant » du propriétaire.
export async function payoutSeller(seller: { id: string; stripeAccountId: string }, ownerId: string | null, now = new Date()): Promise<Result> {
  if (!stripe) throw new Error("Stripe n'est pas configuré");
  const accountId = seller.stripeAccountId;
  // On revérifie auprès de Stripe juste avant de virer (le compte peut avoir été restreint entre-temps)
  // (une erreur Stripe pour un vendeur ne doit pas bloquer les versements des autres)
  const active = await refreshTransfersStatus(seller.id, accountId)
    .then((r) => r.active)
    .catch(() => false);
  if (!active) {
    return { sellerId: seller.id, amountCents: 0, status: "SKIPPED", reason: "compte Stripe pas prêt" };
  }

  // Prépare le versement en base : les gains sont réservés pour lui (une autre exécution ne peut pas les reprendre)
  const payout = await db.$transaction(async (tx) => {
    const earnings = await tx.sellerEarning.findMany({
      where: { sellerId: seller.id, status: "PENDING", payoutId: null, availableAt: { lte: now } },
      select: { id: true, amountCents: true },
    });
    const total = earnings.reduce((n, e) => n + e.amountCents, 0);
    if (total < minPayoutCents(seller.id, ownerId)) return null;
    const created = await tx.sellerPayout.create({ data: { sellerId: seller.id, amountCents: total } });
    const { count } = await tx.sellerEarning.updateMany({
      where: { id: { in: earnings.map((e) => e.id) }, payoutId: null },
      data: { payoutId: created.id },
    });
    // Si une autre exécution a réservé une partie des gains entre-temps, on annule tout
    if (count !== earnings.length) throw new Error("Gains déjà réservés par un autre versement");
    return created;
  }).catch((err: Error) => err);

  if (payout instanceof Error) {
    return { sellerId: seller.id, amountCents: 0, status: "SKIPPED", reason: payout.message };
  }

  if (!payout) {
    return { sellerId: seller.id, amountCents: 0, status: "SKIPPED", reason: "minimum de versement pas atteint" };
  }
  return sendTransfer(payout, accountId);
}
