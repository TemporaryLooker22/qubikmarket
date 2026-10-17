import "server-only";
import Stripe from "stripe";
import { db } from "./db";

// Sans clé Stripe dans .env, Qubik fonctionne en "mode démo" : les achats sont simulés.
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const isDemoMode = !stripe;

// Commission de la plateforme (10 %)
export const PLATFORM_FEE_PERCENT = 10;

// Ce que le vendeur touche sur une vente (prix moins la commission)
export function sellerNetCents(amountCents: number) {
  return amountCents - Math.round((amountCents * PLATFORM_FEE_PERCENT) / 100);
}

export async function createCheckoutSession(opts: {
  purchaseId: string;
  title: string;
  priceCents: number;
  slug: string;
}) {
  if (!stripe) throw new Error("Stripe n'est pas configuré");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: opts.priceCents,
          product_data: { name: opts.title },
        },
      },
    ],
    metadata: { purchaseId: opts.purchaseId },
    payment_intent_data: { metadata: { purchaseId: opts.purchaseId } },
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/resources/${opts.slug}`,
  });
}

// Paiement Stripe terminé : l'achat passe en « payé » (appelé par le webhook et par la page de retour).
// Sans effet si la session n'est pas payée ou si l'achat est déjà enregistré : on peut l'appeler plusieurs fois.
export async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const purchaseId = session.metadata?.purchaseId;
  if (!purchaseId || session.payment_status !== "paid") return;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);

  await db.purchase.updateMany({
    where: { id: purchaseId, status: { not: "PAID" } },
    data: { status: "PAID", paidAt: new Date(), stripeSessionId: session.id, stripePaymentIntentId: paymentIntentId },
  });
}

// Remboursement ou contestation bancaire : l'acheteur perd l'accès au téléchargement
export async function setPurchaseStatusByPaymentIntent(paymentIntentId: string, status: "PAID" | "REFUNDED" | "DISPUTED") {
  await db.purchase.updateMany({ where: { stripePaymentIntentId: paymentIntentId }, data: { status } });
}
