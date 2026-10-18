import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { touchLastSeen, unreadConversations } from "@/lib/chat";

// Icône Messages de la barre de navigation : nombre de conversations avec des messages non lus.
// Appelé toutes les 30 s, il sert aussi à savoir qui est en ligne (point vert).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ unread: 0 }, { status: 401 });
  const [unread] = await Promise.all([unreadConversations(user.id), touchLastSeen(user.id)]);
  return NextResponse.json({ unread }, { headers: { "Cache-Control": "private, no-store" } });
}
