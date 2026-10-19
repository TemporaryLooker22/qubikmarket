import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { popularRobloxRefs } from "@/lib/roblox-refs";

// Modération → Thumbnails : miniatures des jeux Roblox populaires à choisir comme références (admins seulement)
export async function GET() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  try {
    return NextResponse.json({ refs: await popularRobloxRefs() }, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch (err) {
    console.error("Références Roblox :", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message, refs: [] }, { status: 502 });
  }
}
