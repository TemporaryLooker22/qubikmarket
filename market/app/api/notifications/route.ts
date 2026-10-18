import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Notifications du membre connecté (cloche de la barre de navigation)
// GET : les 30 dernières et le nombre de non lues (?count=1 : seulement le nombre)
// POST : tout marquer comme lu

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ unread: 0, items: [] }, { status: 401 });
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  if (new URL(req.url).searchParams.get("count")) return NextResponse.json({ unread });
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, type: true, data: true, link: true, readAt: true, createdAt: true },
  });
  return NextResponse.json({ unread, items }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
