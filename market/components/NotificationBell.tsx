"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  Bell,
  CornerDownRight,
  Crown,
  Download,
  Flag,
  Loader2,
  MessageSquareWarning,
  Pencil,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/i18n/format";
import type { NotifText } from "@/lib/i18n/dictionaries";

type Item = { id: string; type: string; data: Omit<NotifText, "money">; link: string | null; readAt: string | null; createdAt: string };

// Icône et couleur de chaque sorte de notification
const ICONS: Record<string, { Icon: LucideIcon; tone: string }> = {
  SALE: { Icon: ShoppingCart, tone: "bg-ok-bg text-ok" },
  FREE_GET: { Icon: Download, tone: "bg-surface text-text" },
  REFUND: { Icon: RotateCcw, tone: "bg-bad-bg text-bad" },
  DISPUTE: { Icon: ShieldAlert, tone: "bg-bad-bg text-bad" },
  DISPUTE_WON: { Icon: ShieldCheck, tone: "bg-ok-bg text-ok" },
  PAYOUT: { Icon: Banknote, tone: "bg-ok-bg text-ok" },
  FOUNDER: { Icon: Crown, tone: "bg-accent-soft text-text" },
  RES_LIVE: { Icon: BadgeCheck, tone: "bg-ok-bg text-ok" },
  RES_APPROVED: { Icon: BadgeCheck, tone: "bg-ok-bg text-ok" },
  RES_RELISTED: { Icon: BadgeCheck, tone: "bg-ok-bg text-ok" },
  VER_LIVE: { Icon: BadgeCheck, tone: "bg-ok-bg text-ok" },
  RES_HELD: { Icon: ShieldAlert, tone: "bg-warn-bg text-warn" },
  VER_HELD: { Icon: ShieldAlert, tone: "bg-warn-bg text-warn" },
  RES_REJECTED: { Icon: ShieldX, tone: "bg-bad-bg text-bad" },
  VER_REJECTED: { Icon: ShieldX, tone: "bg-bad-bg text-bad" },
  RES_UNLISTED: { Icon: ShieldX, tone: "bg-warn-bg text-warn" },
  RES_DELETED: { Icon: Trash2, tone: "bg-bad-bg text-bad" },
  RES_EDITED: { Icon: Pencil, tone: "bg-surface text-text" },
  REVIEW_NEW: { Icon: Star, tone: "bg-accent-soft text-text" },
  REVIEW_REPLY: { Icon: CornerDownRight, tone: "bg-surface text-text" },
  REVIEW_REMOVED: { Icon: Trash2, tone: "bg-surface text-muted" },
  NEW_VERSION: { Icon: Sparkles, tone: "bg-accent-soft text-text" },
  MOD_PENDING: { Icon: ShieldCheck, tone: "bg-accent-soft text-text" },
  MOD_FLAG: { Icon: Flag, tone: "bg-warn-bg text-warn" },
  MOD_REPORT: { Icon: MessageSquareWarning, tone: "bg-bad-bg text-bad" },
};

// Cloche de la barre de navigation : pastille des notifications non lues, et la liste au clic.
// Le nombre se met à jour toutes les minutes ; ouvrir la liste marque tout comme lu.
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Item[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Nombre de non lues : au changement de page et toutes les minutes
  const refreshCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?count=1", { cache: "no-store" });
      if (res.ok) setUnread((await res.json()).unread);
    } catch {
      // hors ligne : on réessaiera
    }
  }, []);
  useEffect(() => {
    refreshCount();
    const timer = setInterval(() => document.visibilityState === "visible" && refreshCount(), 60_000);
    return () => clearInterval(timer);
  }, [pathname, refreshCount]);

  // Ferme au clic à l'extérieur, avec Échap et au changement de page
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const toggle = async () => {
    if (open) return setOpen(false);
    setOpen(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.items);
      // Ouvrir la liste vaut lecture : la pastille disparaît (les nouvelles restent mises en avant cette fois-ci)
      if (json.unread > 0) {
        setUnread(0);
        fetch("/api/notifications", { method: "POST" }).catch(() => {});
      }
    } catch {
      setItems([]);
    }
  };

  const ago = (iso: string) => {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { numeric: "auto" });
    const abs = Math.abs(seconds);
    if (abs < 60) return rtf.format(Math.round(seconds), "second");
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
    return rtf.format(Math.round(seconds / 86400), "day");
  };
  const text = (item: Item) => {
    const render = t.notif.types[item.type];
    return render ? render({ ...item.data, money: formatAmount(item.data.amount ?? 0, locale) }) : item.type;
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `${t.notif.open} (${t.notif.unread(unread)})` : t.notif.open}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-text transition hover:bg-bg"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t.notif.title}
          className="animate-pop fixed inset-x-3 top-20 z-30 max-h-[70vh] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="font-semibold">{t.notif.title}</p>
          </div>
          <div className="max-h-[calc(70vh-49px)] overflow-y-auto">
            {items === null ? (
              <p className="flex justify-center py-8 text-muted">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              </p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">{t.notif.empty}</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const { Icon, tone } = ICONS[item.type] ?? { Icon: Bell, tone: "bg-surface text-text" };
                  const body = (
                    <>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug">{text(item)}</span>
                        <span className="mt-0.5 block text-xs text-muted">{ago(item.createdAt)}</span>
                      </span>
                      {!item.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
                    </>
                  );
                  const style = `flex gap-3 px-4 py-3 transition ${item.readAt ? "" : "bg-accent-soft/50"}`;
                  return (
                    <li key={item.id}>
                      {item.link ? (
                        <Link href={item.link} onClick={() => setOpen(false)} className={`${style} hover:bg-bg`}>
                          {body}
                        </Link>
                      ) : (
                        <div className={style}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
