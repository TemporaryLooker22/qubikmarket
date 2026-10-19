"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { splitLinks } from "@/lib/chat-text";
import { acknowledgeModeratorMessage } from "@/app/chat-actions";
import { UserAvatar } from "@/components/UserAvatar";

type Notice = {
  conversationId: string;
  moderator: { username: string; avatarUrl: string | null };
  messages: { id: string; body: string; images: string[]; createdAt: string }[];
};

// Fenêtre affichée à l'arrivée sur le site quand un modérateur a écrit au membre et qu'il ne l'a pas encore lu.
// « J'ai compris » la marque comme lue ; « Répondre » ouvre la conversation.
export function ModeratorNotice({ notice }: { notice: Notice | null }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(Boolean(notice));
  const [pending, startTransition] = useTransition();
  useEffect(() => setOpen(Boolean(notice)), [notice?.conversationId, notice?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pas besoin de la fenêtre dans la conversation elle-même
  if (!notice || !open || pathname === `/messages/${notice.conversationId}`) return null;
  const s = t.modNotice;
  const close = () => {
    setOpen(false);
    startTransition(() => acknowledgeModeratorMessage(notice.conversationId));
  };
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="mod-notice-title">
      <div className="animate-pop w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center gap-3 bg-text px-5 py-4 text-bg">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-text">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p id="mod-notice-title" className="text-lg font-semibold">
              {s.title}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-bg/70">
              <UserAvatar name={notice.moderator.username} src={notice.moderator.avatarUrl} size={18} />
              {s.from(notice.moderator.username)}
            </p>
          </div>
        </div>
        <div className="max-h-[50vh] space-y-3 overflow-y-auto px-5 py-4">
          {notice.messages.map((m) => (
            <div key={m.id}>
              {m.body && (
                <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                  {splitLinks(m.body).map((part, i) =>
                    part.href ? (
                      <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        {part.text}
                      </a>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </p>
              )}
              {m.images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.images.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-24 rounded-lg border border-border object-cover" />
                    </a>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-muted">{when(m.createdAt)}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <Link
            href={`/messages/${notice.conversationId}`}
            onClick={() => setOpen(false)}
            className="flex h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold transition hover:bg-bg"
          >
            {s.reply}
          </Link>
          <button type="button" onClick={close} disabled={pending} autoFocus className="h-11 rounded-xl bg-accent px-6 text-sm font-semibold text-text transition hover:bg-accent-hover disabled:opacity-60">
            {s.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
