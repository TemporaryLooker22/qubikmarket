"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { CHAT_COUNT_POLL_MS } from "@/lib/chat-text";
import { UserAvatar } from "@/components/UserAvatar";

export type ConversationItem = {
  id: string;
  username: string;
  avatarUrl: string | null;
  online: boolean;
  preview: string;
  fromMe: boolean;
  at: string; // date du dernier message
  unread: boolean;
};

// Cadre de la messagerie : liste des conversations à gauche, conversation ouverte à droite.
// Sur téléphone : la liste seule sur /messages, la conversation seule ailleurs.
export function ChatShell({ items, children }: { items: ConversationItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onList = pathname === "/messages";

  // La liste se met à jour toutes les 30 s (nouveaux messages des autres conversations)
  useEffect(() => {
    const timer = setInterval(() => document.visibilityState === "visible" && router.refresh(), CHAT_COUNT_POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="container-q pt-4 sm:pt-6">
      <div className="grid h-[calc(100dvh-7.5rem)] min-h-[420px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className={`min-h-0 flex-col border-border md:flex md:border-r ${onList ? "flex" : "hidden"}`}>
          <ConversationList items={items} />
        </div>
        <div className={`min-h-0 min-w-0 flex-col md:flex ${onList ? "hidden" : "flex"}`}>{children}</div>
      </div>
    </div>
  );
}

function ConversationList({ items }: { items: ConversationItem[] }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => items.filter((c) => c.username.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);
  const intl = locale === "fr" ? "fr-FR" : "en-GB";

  // Heure aujourd'hui, « Hier », jour de la semaine, puis la date
  const when = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
    if (days === 0) return d.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return t.chat.yesterday;
    if (days < 7) return d.toLocaleDateString(intl, { weekday: "short" });
    return d.toLocaleDateString(intl, { day: "numeric", month: "short" });
  };

  return (
    <>
      <div className="px-4 pb-2 pt-4">
        <h1 className="text-lg font-semibold tracking-tight">{t.chat.title}</h1>
        {items.length > 3 && (
          <label className="mt-3 flex items-center gap-2 rounded-xl bg-bg px-3 py-2 text-sm text-muted">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.chat.search} className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-muted" />
          </label>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <MessageCircle className="h-7 w-7 text-muted" aria-hidden="true" />
            <p className="font-semibold">{t.chat.emptyTitle}</p>
            <p className="text-sm text-muted">{t.chat.emptyText}</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">{t.chat.noMatch}</p>
        ) : (
          <ul className="pb-1">
            {shown.map((c) => {
              const active = pathname === `/messages/${c.id}`;
              return (
                <li key={c.id}>
                  <Link
                    href={`/messages/${c.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 border-l-[3px] px-3.5 py-2.5 transition hover:bg-bg ${active ? "border-accent bg-bg" : "border-transparent"}`}
                  >
                    <Avatar name={c.username} src={c.avatarUrl} online={c.online} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{c.username}</span>
                        <span className="shrink-0 text-[11.5px] text-muted">{when(c.at)}</span>
                      </span>
                      <span className={`block truncate text-[13px] ${c.unread ? "font-semibold text-text" : "text-muted"}`}>
                        {c.fromMe && t.chat.you}
                        {c.preview === "📷" ? t.chat.image : c.preview}
                      </span>
                    </span>
                    {c.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label={t.chat.unread(1)} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

// Avatar rond avec l'initiale, et le point vert « en ligne »
export function Avatar({ name, src, online, small }: { name: string; src?: string | null; online?: boolean; small?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="relative shrink-0">
      <UserAvatar name={name} src={src} size={small ? 32 : 40} />
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-[#22a559]" aria-label={t.chat.online} />}
    </span>
  );
}
