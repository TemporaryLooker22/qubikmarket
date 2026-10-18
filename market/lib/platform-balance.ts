import "server-only";
import { db } from "./db";
import { stripe } from "./payments";

// Argent sur le compte Stripe de Qubik (Modération → Vue d'ensemble).
// Chaque paiement arrive en entier sur ce compte : la part des vendeurs y attend le versement du lundi
// (lib/payouts.ts). Ce qu'on peut retirer sans risque = solde disponible − gains pas encore versés.

export type PlatformBalance = {
  reservedCents: number; // gains vendeurs pas encore versés (régularisations comprises)
  reservedSellers: number;
  noAccountCents: number; // dont : vendeurs qui n'ont pas encore relié Stripe
  stripe: null | {
    availableCents: number;
    pendingCents: number;
    safeCents: number; // ce que tu peux retirer sans toucher à l'argent des vendeurs
    upcomingCents: number; // ta part encore en attente chez Stripe : retirable une fois débloquée
    missingCents: number; // > 0 : le solde total ne suffit plus pour payer les vendeurs
    payoutInterval: string | null; // "manual", "daily", "weekly", "monthly" (null : inconnu)
  };
};

const eur = (list: { amount: number; currency: string }[]) => list.filter((b) => b.currency === "eur").reduce((n, b) => n + b.amount, 0);

export async function platformBalance(): Promise<PlatformBalance> {
  const pending = await db.sellerEarning.groupBy({ by: ["sellerId"], where: { status: "PENDING" }, _sum: { amountCents: true } });
  const owed = pending.map((g) => ({ sellerId: g.sellerId, cents: g._sum.amountCents ?? 0 })).filter((g) => g.cents > 0);
  const withoutAccount = owed.length
    ? new Set((await db.user.findMany({ where: { id: { in: owed.map((g) => g.sellerId) }, stripeAccountId: null }, select: { id: true } })).map((u) => u.id))
    : new Set<string>();
  const reservedCents = owed.reduce((n, g) => n + g.cents, 0);
  const result: PlatformBalance = {
    reservedCents,
    reservedSellers: owed.length,
    noAccountCents: owed.filter((g) => withoutAccount.has(g.sellerId)).reduce((n, g) => n + g.cents, 0),
    stripe: null,
  };
  if (!stripe) return result;

  const [balance, account] = await Promise.all([
    stripe.balance.retrieve(),
    // Le compte Stripe de Qubik lui-même (sans identifiant) : on lit seulement le rythme des virements bancaires
    stripe.accounts.retrieveCurrent().catch(() => null),
  ]);
  const availableCents = eur(balance.available);
  const pendingCents = eur(balance.pending);
  result.stripe = {
    availableCents,
    pendingCents,
    safeCents: Math.max(0, availableCents - reservedCents),
    upcomingCents: Math.max(0, availableCents + pendingCents - reservedCents) - Math.max(0, availableCents - reservedCents),
    missingCents: Math.max(0, reservedCents - availableCents - pendingCents),
    payoutInterval: account?.settings?.payouts?.schedule?.interval ?? null,
  };
  return result;
}
