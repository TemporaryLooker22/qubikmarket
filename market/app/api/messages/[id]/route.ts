import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isOnline, markConversationRead, MESSAGE_SELECT, otherIdOf, otherReadOf, sendBlock, toChatMessages, touchLastSeen } from "@/lib/chat";

// Conversation ouverte : appelé toutes les 3 s pour les nouveaux messages (?after=date du dernier reçu),
// la lecture par l'autre (« Vu »), son point vert et si on peut toujours lui écrire. Marque la conversation comme lue.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const conversation = await db.conversation.findFirst({ where: { id, OR: [{ userAId: user.id }, { userBId: user.id }] } });
  if (!conversation) return NextResponse.json({ error: "notFound" }, { status: 404 });

  const otherId = otherIdOf(conversation, user.id);
  const after = new Date(new URL(req.url).searchParams.get("after") ?? 0);
  const [messages, other, blocked] = await Promise.all([
    db.message.findMany({
      where: { conversationId: id, createdAt: { gt: Number.isNaN(after.getTime()) ? new Date(0) : after } },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: MESSAGE_SELECT,
    }),
    db.user.findUnique({ where: { id: otherId }, select: { lastSeenAt: true } }),
    sendBlock(user.id, otherId),
    markConversationRead(id, user.id),
    touchLastSeen(user.id),
  ]);
  return NextResponse.json(
    { messages: await toChatMessages(messages), otherRead: otherReadOf(conversation, user.id), online: isOnline(other?.lastSeenAt ?? null), blocked },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
