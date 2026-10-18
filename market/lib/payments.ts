import "server-only";
import Stripe from "stripe";
import { db } from "./db";
import { recordSaleEarning, restoreSaleEarning, reverseSaleEarning } from "./earnings";

// Sans clé Stripe dans .env, Qubik fonctionne en "mode démo" : les achats sont simulés.
export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const isDemoMode = !stripe;

// Commission de la plateforme (définie dans lib/earnings.ts avec le reste du calcul des gains)
export { PLATFORM_FEE_PERCENT } from "./earnings";

// Catégorie fiscale Stripe Tax des ressources (liste officielle : https://docs.stripe.com/tax/tax-codes)
// « Services fournis par voie électronique » : le régime de TVA européen des produits numériques
export const TAX_CODE = "txcd_10000000";

const BUYER_FEE_KIND = "buyer_fee";

export async function createCheckoutSession(opts: {
  purchaseId: string;
  title: string;
  priceCents: number;
  feeCents: number; // frais de service payés par l'acheteur (lib/buyer-fee.ts)
  feeLabel: string;
  slug: string;
  email: string;
}) {
  if (!stripe) throw new Error("Stripe n'est pas configuré");
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // « Managed Payments » (Stripe vendeur à notre place) est activé par défaut sur le compte, mais il est
  // incompatible avec Connect (le paiement des vendeurs) : on le désactive pour chaque paiement.
  // (Paramètre accepté par l'API mais pas encore connu de notre version du SDK, d'où l'ajout à part.)
  const disableManagedPayments = { managed_payments: { enabled: false } } as Partial<Stripe.Checkout.SessionCreateParams>;

  return stripe.checkout.sessions.create({
    ...disableManagedPayments,
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: opts.priceCents,
          // Le prix affiché est TVA comprise : Stripe en extrait la TVA du pays de l'acheteur
          tax_behavior: "inclusive",
          product_data: { name: opts.title, tax_code: TAX_CODE },
        },
      },
      // Frais de service, sur une ligne à part (reconnue au paiement grâce à metadata.kind)
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: opts.feeCents,
          tax_behavior: "inclusive",
          product_data: { name: opts.feeLabel, tax_code: TAX_CODE, metadata: { kind: BUYER_FEE_KIND } },
        },
      },
    ],
    // TVA calculée par Stripe Tax, à la charge de Qubik (la plateforme vend en son nom)
    automatic_tax: { enabled: true, liability: { type: "self" } },
    customer_email: opts.email,
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

  const paidAt = new Date();

  // Frais de service de l'acheteur et leur TVA (la ligne « frais » du paiement) : ils ne vont pas au vendeur
  const lines = await stripe!.checkout.sessions.listLineItems(session.id, { expand: ["data.price.product"] });
  const feeLine = lines.data.find((l) => {
    const product = l.price?.product;
    return typeof product === "object" && product !== null && !product.deleted && product.metadata?.kind === BUYER_FEE_KIND;
  });

  await db.$transaction(async (tx) => {
    // Seulement depuis « en attente » : un ancien événement reçu en retard ne doit pas annuler un remboursement
    const { count } = await tx.purchase.updateMany({
      where: { id: purchaseId, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt,
        stripeSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        // Montant réellement payé et TVA comprise dedans
        ...(session.amount_total !== null && { amountCents: session.amount_total }),
        taxCents: session.total_details?.amount_tax ?? 0,
        buyerFeeCents: feeLine?.amount_total ?? 0,
        buyerFeeTaxCents: feeLine?.amount_tax ?? 0,
      },
    });
    if (count === 1) await recordSaleEarning(tx, purchaseId, paidAt);
  });
}

// Remboursement ou contestation bancaire : l'acheteur perd l'accès au téléchargement et le gain du vendeur est annulé.
// Contestation gagnée : tout revient comme avant.
export async function setPurchaseStatusByPaymentIntent(paymentIntentId: string, status: "PAID" | "REFUNDED" | "DISPUTED") {
  await db.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, select: { id: true, status: true } });
    if (!purchase || purchase.status === "PENDING" || purchase.status === status) return;
    await tx.purchase.update({ where: { id: purchase.id }, data: { status } });
    if (status === "PAID") await restoreSaleEarning(tx, purchase.id);
    else await reverseSaleEarning(tx, purchase.id);
  });
}
