import { NextResponse } from "next/server";
import { runWeeklyPayouts } from "@/lib/payouts";

// Versements hebdomadaires, lancés chaque lundi par Vercel (voir vercel.json).
// Vercel envoie « Authorization: Bearer <CRON_SECRET> » : personne d'autre ne peut déclencher les virements.
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const results = await runWeeklyPayouts();
  return NextResponse.json({
    paid: results.filter((r) => r.status === "PAID").length,
    failed: results.filter((r) => r.status === "FAILED").length,
    skipped: results.filter((r) => r.status === "SKIPPED").length,
    results,
  });
}
