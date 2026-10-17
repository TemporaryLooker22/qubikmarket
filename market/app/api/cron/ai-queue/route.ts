import { NextResponse } from "next/server";
import { processAiQueue, queueLength } from "@/lib/ai/run";

// Filet de sécurité de la file d'analyse IA, lancé une fois par jour par Vercel (voir vercel.json) :
// la file avance surtout quand quelqu'un publie ou regarde Mon espace (voir lib/ai/run.ts).
// Vercel envoie « Authorization: Bearer <CRON_SECRET> ».
export const maxDuration = 120;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await processAiQueue();
  return NextResponse.json({ remaining: await queueLength() });
}
