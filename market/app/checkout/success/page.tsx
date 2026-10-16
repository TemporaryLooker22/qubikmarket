import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { stripe } from "@/lib/payments";

// Page de retour après un paiement Stripe : on vérifie auprès de Stripe que le paiement est bien passé
export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  if (!stripe || !session_id) redirect("/dashboard");

  const session = await stripe.checkout.sessions.retrieve(session_id);
  const purchase = await db.purchase.findUnique({
    where: { stripeSessionId: session.id },
    include: { resource: { select: { slug: true, title: true } } },
  });
  if (!purchase) redirect("/dashboard");

  if (session.payment_status === "paid" && purchase.status !== "PAID") {
    await db.purchase.update({ where: { id: purchase.id }, data: { status: "PAID" } });
  }

  const paid = session.payment_status === "paid";
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <h1 className="text-2xl font-bold">{paid ? "Paiement confirmé ✓" : "Paiement en cours…"}</h1>
      <p className="mt-2 text-muted">
        {paid ? `« ${purchase.resource.title} » est maintenant dans tes achats.` : "Rafraîchis la page dans quelques instants."}
      </p>
      <Link href={`/resources/${purchase.resource.slug}`} className="btn mt-6">Voir la ressource</Link>
    </div>
  );
}
