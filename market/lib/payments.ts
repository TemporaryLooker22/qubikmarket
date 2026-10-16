import "server-only";
import Stripe from "stripe";

// Sans clé Stripe dans .env, Qubik fonctionne en "mode démo" : les achats sont simulés.
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const isDemoMode = !stripe;

// Commission de la plateforme (10 %)
export const PLATFORM_FEE_PERCENT = 10;

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
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/resources/${opts.slug}`,
  });
}
