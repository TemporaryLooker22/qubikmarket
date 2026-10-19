import "server-only";
import type { Prisma } from "@prisma/client";
import { FOUNDER_FEE_PERCENT } from "./sellers";
import { PROMO_MAX } from "./promotion-shared";

// Registre des gains des vendeurs (table SellerEarning).
// Une vente payée crée un gain « PENDING », versable après le délai de sécurité.
// Un remboursement ou une contestation l'annule (ou crée une régularisation négative s'il a déjà été versé).

export const PLATFORM_FEE_PERCENT = 4; // commission de Qubik, sur le prix hors TVA
export const HOLD_DAYS = 7; // délai avant de pouvoir verser un gain (remboursements, contestations)
const DAY = 24 * 60 * 60 * 1000;

type Tx = Prisma.TransactionClient;

// Commission du vendeur au moment de la vente (taux réduit pendant sa période de fondateur)
export function feePercentFor(seller: { founderUntil: Date | null }, at: Date) {
  return seller.founderUntil && at < seller.founderUntil ? FOUNDER_FEE_PERCENT : PLATFORM_FEE_PERCENT;
}

// Partage d'une vente : la TVA va à l'État, la commission est calculée sur le prix hors TVA, le reste au vendeur
export function splitSale(grossCents: number, taxCents: number, feePercent: number) {
  const netOfTax = grossCents - taxCents;
  const feeCents = Math.round((netOfTax * feePercent) / 100);
  return { feeCents, amountCents: netOfTax - feeCents };
}

// Vente payée : crée le gain du vendeur (une seule fois par achat)
export async function recordSaleEarning(tx: Tx, purchaseId: string, paidAt: Date) {
  const purchase = await tx.purchase.findUnique({
    where: { id: purchaseId },
    select: { amountCents: true, taxCents: true, buyerFeeCents: true, buyerFeeTaxCents: true, earning: { select: { id: true } }, resource: { select: { promoPercent: true, seller: { select: { id: true, founderUntil: true } } } } },
  });
  if (!purchase || purchase.amountCents === 0) return;
  // Nouvel achat après un remboursement : l'ancien gain (annulé ou régularisé) reste dans l'historique, détaché de l'achat
  if (purchase.earning) await tx.sellerEarning.update({ where: { id: purchase.earning.id }, data: { purchaseId: null } });
  const seller = purchase.resource.seller;
  // Commission normale, ou celle choisie pour la mise en avant si elle est plus haute (lib/promotion.ts)
  const feePercent = Math.min(PROMO_MAX, Math.max(feePercentFor(seller, paidAt), purchase.resource.promoPercent ?? 0));
  // Le vendeur est payé sur le prix de sa ressource : les frais de service de l'acheteur (et leur TVA) restent à Qubik
  const grossCents = purchase.amountCents - purchase.buyerFeeCents;
  const taxCents = purchase.taxCents - purchase.buyerFeeTaxCents;
  const { feeCents, amountCents } = splitSale(grossCents, taxCents, feePercent);
  await tx.sellerEarning.create({
    data: {
      sellerId: seller.id,
      purchaseId,
      amountCents,
      grossCents,
      taxCents,
      feeCents,
      feePercent,
      availableAt: new Date(paidAt.getTime() + HOLD_DAYS * DAY),
    },
  });
}

// Vente remboursée ou contestée : gain pas encore versé → annulé ; déjà versé → régularisation négative,
// déduite du prochain versement
export async function reverseSaleEarning(tx: Tx, purchaseId: string) {
  const earning = await tx.sellerEarning.findUnique({ where: { purchaseId }, include: { reversal: true } });
  if (!earning) return;
  if (earning.status === "PENDING") {
    await tx.sellerEarning.update({ where: { id: earning.id }, data: { status: "CANCELED" } });
  } else if (earning.status === "PAID" && !earning.reversal) {
    await tx.sellerEarning.create({
      data: { sellerId: earning.sellerId, reversesId: earning.id, amountCents: -earning.amountCents, availableAt: new Date() },
    });
  }
}

// Contestation gagnée : on remet le gain comme avant la contestation
export async function restoreSaleEarning(tx: Tx, purchaseId: string) {
  const earning = await tx.sellerEarning.findUnique({ where: { purchaseId }, include: { reversal: true } });
  if (!earning) return;
  if (earning.status === "CANCELED") {
    await tx.sellerEarning.update({ where: { id: earning.id }, data: { status: "PENDING" } });
  } else if (earning.reversal?.status === "PENDING") {
    // La régularisation n'a pas encore été déduite d'un versement : on l'annule
    await tx.sellerEarning.update({ where: { id: earning.reversal.id }, data: { status: "CANCELED" } });
  }
  // Cas rare (régularisation déjà déduite d'un versement) : à régler à la main depuis le tableau de bord Stripe
}
