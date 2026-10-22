import type { Prisma } from "@prisma/client";

// Une vraie vente : un achat payant, payé et passé par Stripe.
// Les achats payants sans session Stripe (anciennes ventes de démo) restent dans la base,
// mais ne comptent pas dans les statistiques ni dans « Les plus vendues ».
export const REAL_SALE = {
  status: "PAID",
  amountCents: { gt: 0 },
  stripeSessionId: { not: null },
} satisfies Prisma.PurchaseWhereInput;
