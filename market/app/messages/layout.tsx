import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { isOnline, mine, myReadOf } from "@/lib/chat";
import { ChatShell, type ConversationItem } from "@/components/chat/ChatShell";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.chat.title, robots: { index: false } };
}

// Messagerie : la liste des conversations reste affichée pendant qu'on passe de l'une à l'autre.
// Pas connecté : chaque page renvoie vers la connexion (en revenant au bon endroit ensuite).
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return children;

  const conversations = await db.conversation.findMany({
    where: mine(user.id),
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: { userA: { select: { username: true, lastSeenAt: true } }, userB: { select: { username: true, lastSeenAt: true } } },
  });
  const items: ConversationItem[] = conversations.map((c) => {
    const other = c.userAId === user.id ? c.userB : c.userA;
    const read = myReadOf(c, user.id);
    return {
      id: c.id,
      username: other.username,
      online: isOnline(other.lastSeenAt),
      preview: c.lastPreview,
      fromMe: c.lastSenderId === user.id,
      at: c.lastMessageAt.toISOString(),
      unread: c.lastSenderId !== null && c.lastSenderId !== user.id && (!read || read < c.lastMessageAt),
    };
  });
  return <ChatShell items={items}>{children}</ChatShell>;
}
