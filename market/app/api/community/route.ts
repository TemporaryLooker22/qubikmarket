import { NextResponse } from "next/server";
import { communityCounts } from "@/lib/community";

export const dynamic = "force-dynamic";

// Chiffres de la communauté pour l'accueil (membres, vendeurs, gains des vendeurs), relus toutes les 15 s par la page.
// Gardés 10 s en cache par Vercel pour que les visiteurs nombreux ne recalculent pas tout à chaque fois.
export async function GET() {
  return NextResponse.json(await communityCounts(), { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } });
}
