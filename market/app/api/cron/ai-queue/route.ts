import { NextResponse } from "next/server";
import { processAiQueue, queueLength } from "@/lib/ai/run";
import { purgeOldAnalytics } from "@/lib/analytics";

// Filet de sécurité de la file d'analyse IA, lancé une fois par jour par Vercel (voir vercel.json),
// qui fait aussi le ménage des statistiques de visite de plus de 13 mois.
// La file d'analyse IA avance surtout quand quelqu'un publie ou regarde Mon espace (voir lib/ai/run.ts).
// Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await processAiQueue();
  // Statistiques de visite : on ne garde que 13 mois
  await purgeOldAnalytics().catch((err) => console.error("Statistiques :", err));
  return NextResponse.json({ remaining: await queueLength() });
}
