"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { CHAT_COUNT_POLL_MS } from "@/lib/chat-text";

// Icône Messages de la barre de navigation : nombre de conversations non lues, mis à jour toutes les 30 s
export function MessagesIcon({ initialUnread }: { initialUnread: number }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      if (res.ok) setUnread((await res.json()).unread);
    } catch {
      // hors ligne : on réessaiera
    }
  }, []);
  useEffect(() => {
    refresh();
    const timer = setInterval(() => document.visibilityState === "visible" && refresh(), CHAT_COUNT_POLL_MS);
    return () => clearInterval(timer);
  }, [pathname, refresh]);

  const active = pathname.startsWith("/messages");
  return (
    <Link
      href="/messages"
      aria-label={unread > 0 ? `${t.chat.open} (${t.chat.unread(unread)})` : t.chat.open}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-10 w-10 items-center justify-center rounded-lg text-text transition hover:bg-bg ${active ? "bg-bg" : ""}`}
    >
      <MessageCircle className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
      {unread > 0 && (
        <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
