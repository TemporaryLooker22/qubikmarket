import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { live } from "@/lib/stats";

// Modération → Statistiques → « En ce moment » : visiteurs des 5 dernières minutes (admins seulement)
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  return NextResponse.json(await live(), { headers: { "Cache-Control": "private, no-store" } });
}
