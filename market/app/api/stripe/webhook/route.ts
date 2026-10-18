import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillCheckoutSession, setPurchaseStatusByPaymentIntent, stripe } from "@/lib/payments";

// Webhook Stripe : Stripe prévient le site quand un paiement aboutit, est remboursé ou contesté.
// C'est la source fiable : l'acheteur peut fermer la page avant de revenir sur /checkout/success.
// Adresse déclarée dans Stripe : https://qubikmarket.vercel.app/api/stripe/webhook (toujours valable, voir next.config.ts)
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe non configuré" }, { status: 503 });

  // La signature prouve que le message vient vraiment de Stripe (sinon n'importe qui pourrait « payer »)
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  const paymentIntentOf = (pi: string | { id: string } | null) => (typeof pi === "string" ? pi : (pi?.id ?? null));

  switch (event.type) {
    // Paiement terminé (carte : tout de suite ; virement ou autre moyen différé : plus tard)
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await fulfillCheckoutSession(event.data.object);
      break;

    // Remboursement complet : l'achat n'est plus valable
    case "charge.refunded": {
      const charge = event.data.object;
      const paymentIntent = paymentIntentOf(charge.payment_intent);
      if (paymentIntent && charge.refunded) await setPurchaseStatusByPaymentIntent(paymentIntent, "REFUNDED");
      break;
    }

    // Contestation bancaire : accès suspendu, puis rendu si Qubik gagne la contestation
    case "charge.dispute.created": {
      const paymentIntent = paymentIntentOf(event.data.object.payment_intent);
      if (paymentIntent) await setPurchaseStatusByPaymentIntent(paymentIntent, "DISPUTED");
      break;
    }
    case "charge.dispute.closed": {
      const dispute = event.data.object;
      const paymentIntent = paymentIntentOf(dispute.payment_intent);
      if (paymentIntent) await setPurchaseStatusByPaymentIntent(paymentIntent, dispute.status === "won" ? "PAID" : "REFUNDED");
      break;
    }
  }

  // Toujours répondre 200 aux événements reçus, sinon Stripe les renvoie en boucle
  return NextResponse.json({ received: true });
}
