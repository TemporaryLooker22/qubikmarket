import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createOnboardingLink, refreshTransfersStatus } from "@/lib/connect";

// Reprendre (ou continuer) l'inscription Stripe du vendeur : Stripe renvoie ici quand le lien a expiré,
// et le bouton « Compléter mon inscription » de Mon espace y mène aussi
export async function GET() {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login?next=/dashboard/sales`);

  const seller = await db.user.findUnique({ where: { id: user.id }, select: { stripeAccountId: true } });
  if (!seller?.stripeAccountId) return NextResponse.redirect(`${appUrl}/dashboard/sales`);

  const { merchant } = await refreshTransfersStatus(user.id, seller.stripeAccountId);
  const url = await createOnboardingLink(seller.stripeAccountId, appUrl, !merchant);
  return NextResponse.redirect(url);
}
