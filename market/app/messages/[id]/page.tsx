import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { directUploads } from "@/lib/storage";
import { markConversationRead, MESSAGE_SELECT, otherIdOf, otherReadOf, sendBlock, toChatMessages } from "@/lib/chat";
import { Thread } from "@/components/chat/Thread";
import { aboutResource, otherMember } from "@/components/chat/thread-data";

// Une conversation. ?r= : la ressource depuis laquelle on a cliqué « Contacter le vendeur »
// (sa carte « À propos de » part avec le prochain message, si elle n'est pas déjà dans le fil).
export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string }> }) {
  const [{ id }, { r }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/messages/${id}`);
  const conversation = await db.conversation.findFirst({ where: { id, OR: [{ userAId: user.id }, { userBId: user.id }] } });
  if (!conversation) notFound();

  const otherId = otherIdOf(conversation, user.id);
  const [other, list, blocked, about, aboutAlready] = await Promise.all([
    otherMember(otherId),
    // Les 200 derniers messages
    db.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "desc" }, take: 200, select: MESSAGE_SELECT }),
    sendBlock(user.id, otherId),
    aboutResource(r, [user.id, otherId]),
    r ? db.message.count({ where: { conversationId: id, kind: "ABOUT", resourceId: r } }) : 0,
    markConversationRead(id, user.id),
  ]);
  if (!other) notFound();

  return (
    <Thread
      key={id}
      meId={user.id}
      conversationId={id}
      other={other}
      initial={await toChatMessages(list.reverse())}
      otherRead={otherReadOf(conversation, user.id)?.toISOString() ?? null}
      blocked={blocked}
      pendingAbout={aboutAlready ? null : about}
      canAttach={directUploads}
    />
  );
}
