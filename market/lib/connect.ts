import "server-only";
import { db } from "./db";
import { stripe } from "./payments";

// Stripe Connect : le compte Stripe de chaque vendeur, qui reçoit ses gains par virement.
// Qubik encaisse les paiements puis verse les gains chaque semaine (voir lib/payouts.ts).

// Pays où un vendeur peut recevoir ses gains depuis une plateforme belge (vérifié avec l'API Stripe).
const EUROPE = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH"];
const OTHER = ["US", "CA", "AU", "JP", "SG", "MX"];
export const PAYOUT_COUNTRIES = [...EUROPE, ...OTHER];

// Profils demandés pour chaque compte vendeur. En mode réel, Stripe exige le profil « marchand » (card_payments)
// en plus du profil « destinataire » pour recevoir des virements, même pour un vendeur belge
// (le mode test est plus souple : ne pas s'y fier pour ce point).
const CONFIGURATIONS = ["recipient", "merchant"] as const;

function requireStripe() {
  if (!stripe) throw new Error("Stripe n'est pas configuré");
  return stripe;
}

// Crée le compte Stripe du vendeur (une seule fois) et le garde en base
export async function createSellerAccount(user: { id: string; email: string; username: string }, country: string) {
  const s = requireStripe();
  const account = await s.v2.core.accounts.create({
    contact_email: user.email,
    display_name: user.username,
    // Tableau de bord Stripe « Express » : le vendeur y voit ses virements et son compte bancaire
    dashboard: "express",
    identity: { country: country.toLowerCase() },
    // Qubik paie les frais Stripe et reste responsable en cas de solde négatif (remboursements, contestations)
    defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
    configuration: {
      recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      merchant: { capabilities: { card_payments: { requested: true } } },
    },
    metadata: { qubikUserId: user.id },
  });
  await db.user.update({ where: { id: user.id }, data: { stripeAccountId: account.id, stripeTransfersActive: false } });
  return account.id;
}

// Lien vers le formulaire d'inscription Stripe (identité, IBAN). Il expire vite : on en crée un à chaque clic.
export async function createOnboardingLink(accountId: string, appUrl: string) {
  const s = requireStripe();
  const link = await s.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: [...CONFIGURATIONS],
        refresh_url: `${appUrl}/api/stripe/onboarding`,
        return_url: `${appUrl}/dashboard/sales?onboarding=done`,
      },
    },
  });
  return link.url;
}

// Le vendeur peut-il recevoir des virements ? On demande à Stripe et on garde la réponse en base.
export async function refreshTransfersStatus(userId: string, accountId: string) {
  const s = requireStripe();
  const account = await s.v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient"] });
  const active = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
  await db.user.update({ where: { id: userId }, data: { stripeTransfersActive: active } });
  return { active };
}

// Lien de connexion au tableau de bord Stripe Express du vendeur (ses virements, son compte bancaire)
export async function createDashboardLink(accountId: string) {
  const s = requireStripe();
  const link = await s.accounts.createLoginLink(accountId);
  return link.url;
}
