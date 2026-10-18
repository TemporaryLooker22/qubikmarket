import { MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";

// /messages : sur ordinateur, invite à choisir une conversation dans la liste (sur téléphone, seule la liste s'affiche)
export default async function MessagesPage() {
  await requireUser("/messages");
  const { t } = await getDictionary();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-bg/50 p-8 text-center text-muted">
      <MessageCircle className="h-8 w-8" aria-hidden="true" />
      <p className="text-sm">{t.chat.pick}</p>
    </div>
  );
}
