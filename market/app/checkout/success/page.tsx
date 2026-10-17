import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { stripe } from "@/lib/payments";
import { getDictionary } from "@/lib/i18n/server";

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
  const { t } = await getDictionary();
  return (
    <>
      <h1>{paid ? t.checkout.paid : t.checkout.pending}</h1>
      <p>
        {paid ? t.checkout.paidText(purchase.resource.title) : t.checkout.pendingText}
      </p>
      <Link href={`/resources/${purchase.resource.slug}`}>{t.checkout.see}</Link>
    </>
  );
}
