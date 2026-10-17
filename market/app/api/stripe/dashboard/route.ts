import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createDashboardLink } from "@/lib/connect";

// Ouvre le tableau de bord Stripe Express du vendeur (ses virements, son compte bancaire)
export async function GET() {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login?next=/dashboard/sales`);

  const seller = await db.user.findUnique({ where: { id: user.id }, select: { stripeAccountId: true, stripeTransfersActive: true } });
  if (!seller?.stripeAccountId || !seller.stripeTransfersActive) return NextResponse.redirect(`${appUrl}/dashboard/sales`);
  return NextResponse.redirect(await createDashboardLink(seller.stripeAccountId));
}
