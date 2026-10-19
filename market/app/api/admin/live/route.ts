import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { live, liveDetail } from "@/lib/stats";

// Modération → Statistiques → « En ce moment » : visiteurs des 5 dernières minutes (admins seulement)
// ?detail=1 : en plus, le détail pour la fenêtre « Voir plus » (pays, appareils, sources, minute par minute)
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const detail = new URL(req.url).searchParams.get("detail") === "1";
  const [summary, more] = await Promise.all([live(), detail ? liveDetail() : Promise.resolve(null)]);
  return NextResponse.json({ ...summary, ...(more && { detail: more }) }, { headers: { "Cache-Control": "private, no-store" } });
}
