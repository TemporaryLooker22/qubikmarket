"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Ban, CheckCheck, Clock, Ellipsis, Flag, ImagePlus, Loader2, Lock, SendHorizontal, ShieldAlert, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { formatPrice } from "@/lib/i18n/format";
import { categoryLabel } from "@/lib/catalog";
import { uploadImage } from "@/lib/upload-client";
import { blockMember, reportConversation, sendMessage, unblockMember } from "@/app/chat-actions";
import { CHAT_IMAGE_MAX_SIDE, CHAT_POLL_MS, MESSAGE_MAX_IMAGES, MESSAGE_MAX_LENGTH, REPORT_REASONS, splitLinks, type ReportReason } from "@/lib/chat-text";
import type { ChatMessage, SendBlock } from "@/lib/chat";
import { Avatar } from "./ChatShell";

export type AboutResource = { id: string; slug: string; title: string; image: string | null; priceCents: number; category: string };

type Props = {
  meId: string;
  conversationId: string | null; // null : première prise de contact (la conversation est créée au premier message)
  other: { id: string; username: string; avatarUrl: string | null; online: boolean; response: string | null; resources: number };
  initial: ChatMessage[];
  otherRead: string | null;
  blocked: SendBlock | null;
  pendingAbout: AboutResource | null; // ressource depuis laquelle on a cliqué « Contacter le vendeur »
  canAttach: boolean; // envoi d'images possible (stockage Vercel Blob configuré)
};

// Réduit une image dans le navigateur avant l'envoi (2048 px au plus, WebP)
async function prepareImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, CHAT_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("image");
  return new File([blob], "image.webp", { type: "image/webp" });
}

// Une conversation : messages (mis à jour toutes les 3 s), envoi de texte et d'images, blocage et signalement
export function Thread({ meId, conversationId: initialId, other, initial, otherRead: initialRead, blocked: initialBlocked, pendingAbout: initialAbout, canAttach }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState(initial);
  const [otherRead, setOtherRead] = useState(initialRead);
  const [online, setOnline] = useState(other.online);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [about, setAbout] = useState(initialAbout);
  const [text, setText] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const intl = locale === "fr" ? "fr-FR" : "en-GB";

  // Ajoute des messages sans doublon (un message envoyé peut aussi revenir par le rafraîchissement)
  const merge = useCallback((list: ChatMessage[]) => {
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id));
      const fresh = list.filter((m) => !known.has(m.id));
      return fresh.length ? [...current, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : current;
    });
  }, []);

  // Nouveaux messages toutes les 3 s (seulement quand l'onglet est visible)
  const last = messages[messages.length - 1]?.createdAt ?? null;
  useEffect(() => {
    if (!conversationId) return;
    let stopped = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/messages/${conversationId}${last ? `?after=${encodeURIComponent(last)}` : ""}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const json = await res.json();
        setOtherRead(json.otherRead);
        setOnline(json.online);
        setBlocked(json.blocked);
        if (json.messages.length) {
          merge(json.messages);
          // La liste à gauche (aperçu et non-lus) suit
          if (json.messages.some((m: ChatMessage) => m.senderId !== meId)) router.refresh();
        }
      } catch {
        // hors ligne : on réessaiera
      }
    };
    const timer = setInterval(poll, CHAT_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [conversationId, last, meId, merge, router]);

  // Toujours en bas de la conversation quand un message arrive
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Ferme le menu ⋯ au clic à l'extérieur ou avec Échap
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    document.addEventListener("click", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", escape);
    };
  }, [menu]);

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setPreparing(true);
    setError(null);
    try {
      const room = MESSAGE_MAX_IMAGES - images.length;
      const list = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
      const prepared = await Promise.all(list.map(prepareImage));
      setImages((current) => [...current, ...prepared.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    } catch {
      setError(t.chat.errors.images);
    } finally {
      setPreparing(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const send = async () => {
    const body = text.trim();
    if (sending || preparing || (!body && images.length === 0)) return;
    setSending(true);
    setError(null);
    try {
      const urls = await Promise.all(images.map((i) => uploadImage(i.file)));
      const result = await sendMessage({ conversationId: conversationId ?? undefined, to: conversationId ? undefined : other.id, aboutId: about?.id, body, images: urls });
      if (!result.ok) {
        setError(t.chat.errors[result.error] ?? t.chat.errors.generic);
        return;
      }
      merge(result.messages);
      setText("");
      images.forEach((i) => URL.revokeObjectURL(i.preview));
      setImages([]);
      setAbout(null);
      if (!conversationId) {
        setConversationId(result.conversationId);
        router.replace(`/messages/${result.conversationId}`);
      }
      router.refresh();
      textarea.current?.focus();
    } catch {
      setError(t.chat.errors.generic);
    } finally {
      setSending(false);
    }
  };

  const toggleBlock = async () => {
    setMenu(false);
    if (blocked === "blockedByMe") {
      await unblockMember(other.id);
      setBlocked(null);
    } else if (window.confirm(t.chat.blockConfirm(other.username))) {
      await blockMember(other.id);
      setBlocked("blockedByMe");
    }
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" });
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const days = Math.floor((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
    if (days === 0) return t.chat.today;
    if (days === 1) return t.chat.yesterday;
    return d.toLocaleDateString(intl, { weekday: "long", day: "numeric", month: "long" });
  };
  // « Vu » sous mon dernier message, si l'autre a ouvert la conversation depuis
  const myLast = [...messages].reverse().find((m) => m.senderId === meId && m.kind === "TEXT");
  const seen = myLast && otherRead && otherRead >= myLast.createdAt ? myLast.id : null;
  const canSend = !blocked;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* En-tête : l'autre membre, son temps de réponse, le menu ⋯ */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 sm:px-4">
        <Link href="/messages" aria-label={t.chat.back} className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-bg md:hidden">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <Link href={`/u/${encodeURIComponent(other.username)}`} className="shrink-0">
          <Avatar name={other.username} src={other.avatarUrl} online={online} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${encodeURIComponent(other.username)}`} className="block truncate font-semibold hover:underline">
            {other.username}
          </Link>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted">
            {online ? <span className="font-semibold text-ok">{t.chat.online}</span> : other.response && <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />}
            {!online && other.response && <span className="truncate">{t.chat.response[other.response]}</span>}
            {other.resources > 0 && <span className="shrink-0">{(online || other.response ? "· " : "") + t.chat.resources(other.resources)}</span>}
          </p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenu((m) => !m);
            }}
            aria-label={t.chat.options}
            aria-expanded={menu}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border transition hover:bg-bg"
          >
            <Ellipsis className="h-4 w-4" aria-hidden="true" />
          </button>
          {menu && (
            <div className="animate-pop absolute right-0 top-11 z-10 w-60 origin-top-right rounded-xl border border-border bg-card p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]">
              {conversationId && (
                <button type="button" onClick={() => setReporting(true)} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition hover:bg-bg">
                  <Flag className="h-4 w-4" aria-hidden="true" /> {t.chat.reportMenu}
                </button>
              )}
              <button type="button" onClick={toggleBlock} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-bad transition hover:bg-bad-bg">
                <Ban className="h-4 w-4" aria-hidden="true" /> {blocked === "blockedByMe" ? t.chat.unblock(other.username) : t.chat.block(other.username)}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto bg-bg/60 px-3 py-4 sm:px-5">
        {messages.length === 0 && (
          <div className="m-auto max-w-sm text-center">
            <p className="font-semibold">{t.chat.newTo(other.username)}</p>
            <p className="mt-1 text-sm text-muted">{t.chat.newHint}</p>
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.senderId === meId;
          const newDay = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          const next = messages[i + 1];
          // L'heure s'affiche à la fin d'une série de messages du même membre
          const showTime = !next || next.senderId !== m.senderId || next.kind !== "TEXT" || new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() > 5 * 60_000;
          return (
            <div key={m.id} className="flex flex-col">
              {newDay && <p className="my-2 self-center text-[11.5px] font-semibold text-muted">{dayLabel(m.createdAt)}</p>}
              {m.kind === "ABOUT" ? (
                m.about && <AboutCard about={m.about} label={t.chat.about} />
              ) : m.deleted ? (
                <p className={`max-w-[78%] rounded-2xl border border-dashed border-border px-3.5 py-2 text-sm italic text-muted ${mine ? "self-end" : "self-start"}`}>{t.chat.deleted}</p>
              ) : (
                <>
                  {m.images.length > 0 && (
                    <div className={`mb-1 grid max-w-[78%] gap-1 ${m.images.length > 1 ? "grid-cols-2" : ""} ${mine ? "self-end" : "self-start"}`}>
                      {m.images.map((src) => (
                        <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-border bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="" loading="lazy" className="max-h-72 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  {m.body && (
                    <p
                      className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14.5px] leading-snug ${
                        mine ? "self-end rounded-br-md bg-accent text-text" : "self-start rounded-bl-md border border-border bg-card"
                      }`}
                    >
                      {splitLinks(m.body).map((part, j) =>
                        part.href ? (
                          <a key={j} href={part.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                            {part.text}
                          </a>
                        ) : (
                          <span key={j}>{part.text}</span>
                        ),
                      )}
                    </p>
                  )}
                  {m.offPlatform && (
                    <div className="my-1.5 flex max-w-md items-start gap-2.5 self-center rounded-xl bg-warn-bg px-3 py-2.5 text-[12.5px] text-warn">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p>
                        <b className="block">{t.chat.offTitle}</b>
                        {t.chat.offText}
                      </p>
                    </div>
                  )}
                  {(showTime || seen === m.id) && (
                    <p className={`mb-1 mt-0.5 flex items-center gap-1 px-1 text-[11px] text-muted ${mine ? "self-end" : "self-start"}`}>
                      {showTime && time(m.createdAt)}
                      {seen === m.id && (
                        <>
                          {showTime && " · "}
                          {t.chat.seen} <CheckCheck className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
                        </>
                      )}
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* Écrire, ou pourquoi on ne peut pas */}
      {!canSend ? (
        <div className="flex flex-col items-center gap-2 border-t border-border px-4 py-4 text-center">
          {blocked === "blockedByMe" ? (
            <>
              <p className="flex items-center gap-2 font-semibold">
                <Ban className="h-4 w-4 text-bad" aria-hidden="true" /> {t.chat.blockedByMeTitle(other.username)}
              </p>
              <p className="text-sm text-muted">{t.chat.blockedByMeText}</p>
              <button type="button" onClick={toggleBlock} className="mt-1 rounded-lg border border-border px-3.5 py-1.5 text-sm font-semibold transition hover:bg-bg">
                {t.chat.unblock(other.username)}
              </button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-2 font-semibold">
                <Lock className="h-4 w-4" aria-hidden="true" /> {t.chat.cantReplyTitle}
              </p>
              <p className="text-sm text-muted">{t.chat.cantReplyText}</p>
            </>
          )}
        </div>
      ) : (
        <div className="border-t border-border">
          {about && (
            <div className="flex items-center gap-3 px-3 pt-3 sm:px-4">
              <AboutCard about={about} label={t.chat.aboutPending} compact />
            </div>
          )}
          {(images.length > 0 || preparing) && (
            <div className="flex gap-2 px-3 pt-3 sm:px-4">
              {images.map((img, i) => (
                <span key={img.preview} className="relative h-14 w-14 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" className="h-full w-full rounded-lg border border-border object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(img.preview);
                      setImages((list) => list.filter((_, j) => j !== i));
                    }}
                    aria-label={t.chat.removeImage}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-text text-bg"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {preparing && (
                <span className="flex h-14 items-center gap-2 text-xs text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t.chat.preparing}
                </span>
              )}
            </div>
          )}
          {error && <p className="px-4 pt-2 text-sm text-bad">{error}</p>}
          <div className="flex items-end gap-2 p-3">
            {canAttach && (
              <>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={images.length >= MESSAGE_MAX_IMAGES || preparing}
                  aria-label={t.chat.addImage}
                  title={t.chat.addImage}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border transition hover:bg-bg disabled:opacity-40"
                >
                  <ImagePlus className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => addImages(e.target.files)} />
              </>
            )}
            <textarea
              ref={textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Entrée envoie, Maj + Entrée passe à la ligne
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder={t.chat.placeholder}
              aria-label={t.chat.placeholder}
              className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14.5px] outline-none transition [field-sizing:content] focus:border-border-strong"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || preparing || (!text.trim() && images.length === 0)}
              aria-label={t.chat.send}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-text transition hover:bg-accent-hover disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}

      {reporting && conversationId && <ReportDialog conversationId={conversationId} onClose={() => setReporting(false)} />}
    </div>
  );
}

// Carte « À propos de [ressource] » (dans le fil, ou au-dessus de la zone d'écriture avant l'envoi)
function AboutCard({ about, label, compact }: { about: Omit<AboutResource, "id">; label: string; compact?: boolean }) {
  const { locale } = useI18n();
  return (
    <Link
      href={`/resources/${about.slug}`}
      className={`flex max-w-sm items-center gap-3 rounded-xl border border-border bg-card p-2 pr-3 transition hover:border-border-strong ${compact ? "" : "my-2 self-center"}`}
    >
      <span className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-lg bg-surface">
        {about.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={about.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</span>
        <span className="block truncate text-sm font-semibold">{about.title}</span>
        <span className="block text-xs text-muted">
          {formatPrice(about.priceCents, locale)} · {categoryLabel(about.category)}
        </span>
      </span>
    </Link>
  );
}

// Fenêtre « Signaler cette conversation » : motif + détails facultatifs
function ReportDialog({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const { t } = useI18n();
  const [reason, setReason] = useState<ReportReason>("SCAM");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    const result = await reportConversation(conversationId, reason, note).catch(() => ({ ok: false }));
    setState(result.ok ? "done" : "error");
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={t.chat.report.title} className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="animate-pop w-full max-w-md rounded-2xl bg-card p-5 shadow-xl">
        <p className="text-lg font-semibold">{t.chat.report.title}</p>
        {state === "done" ? (
          <>
            <p className="mt-2 text-sm text-ok">{t.chat.report.done}</p>
            <button type="button" onClick={onClose} className="mt-4 h-10 w-full rounded-xl bg-text text-sm font-semibold text-bg">
              OK
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">{t.chat.report.text}</p>
            <div className="mt-4 space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label key={r} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${reason === r ? "border-text bg-bg font-semibold" : "border-border"}`}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--color-text)]" />
                  {t.chat.report.reasons[r]}
                </label>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder={t.chat.report.note}
              className="mt-3 min-h-20 w-full resize-y rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-border-strong"
            />
            {state === "error" && <p className="mt-2 text-sm text-bad">{t.chat.errors.generic}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-sm font-semibold text-muted transition hover:bg-bg">
                {t.chat.report.cancel}
              </button>
              <button disabled={state === "sending"} className="h-10 rounded-xl bg-bad px-4 text-sm font-semibold text-white transition disabled:opacity-60">
                {t.chat.report.submit}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
