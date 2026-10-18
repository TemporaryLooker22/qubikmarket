import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { directUploads } from "@/lib/storage";
import { pairOf, sendBlock } from "@/lib/chat";
import { Thread } from "@/components/chat/Thread";
import { aboutResource, otherMember } from "@/components/chat/thread-data";

// « Contacter le vendeur » : /messages/new?to=pseudo&r=ressource.
// Conversation déjà ouverte avec ce membre : on y va. Sinon, un fil vide ; la conversation est créée au premier message.
export default async function NewConversationPage({ searchParams }: { searchParams: Promise<{ to?: string; r?: string }> }) {
  const { to = "", r } = await searchParams;
  const query = new URLSearchParams({ to, ...(r && { r }) });
  const user = await requireUser(`/messages/new?${query}`);

  const target = await db.user.findUnique({ where: { username: to }, select: { id: true } });
  if (!target) notFound();
  if (target.id === user.id) redirect("/messages");

  const existing = await db.conversation.findUnique({ where: { userAId_userBId: pairOf(user.id, target.id) }, select: { id: true } });
  if (existing) redirect(`/messages/${existing.id}${r ? `?r=${encodeURIComponent(r)}` : ""}`);

  const [other, blocked, about] = await Promise.all([otherMember(target.id), sendBlock(user.id, target.id), aboutResource(r, [user.id, target.id])]);
  if (!other) notFound();
  return <Thread meId={user.id} conversationId={null} other={other} initial={[]} otherRead={null} blocked={blocked} pendingAbout={about} canAttach={directUploads} />;
}
