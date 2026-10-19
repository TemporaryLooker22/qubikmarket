"use client";

import { useCallback, useEffect, useState } from "react";
import { LiveGlobeModal } from "./LiveGlobeModal";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/client";
import { UserAvatar } from "@/components/UserAvatar";

type Live = { visitors: number; members: { id: string; username: string; avatarUrl: string | null }[]; pages: { path: string; visitors: number }[] };

// « En ce moment » : visiteurs des 5 dernières minutes, actualisé toutes les 15 s
export function LiveCard({ initial }: { initial: Live }) {
  const { t } = useI18n();
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState(false);
  const closeModal = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/admin/live", { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch {
        // hors ligne : on réessaiera
      }
    }, 15_000);
    return () => clearInterval(timer);
  }, []);
  const max = Math.max(...data.pages.map((p) => p.visitors), 1);
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t.stats.liveTitle}</h2>
        <span className="flex items-center gap-2">
          <span className="text-xs text-muted">{t.stats.liveNote}</span>
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:bg-bg">
            {t.stats.liveMore}
          </button>
        </span>
      </div>
      <p className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className={`absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 ${data.visitors ? "animate-ping" : ""}`} />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-ok" />
        </span>
        <span className="text-4xl font-extrabold tracking-tight">{data.visitors}</span>
        <span className="text-sm text-muted">
          {t.stats.liveVisitors(data.visitors)}
          {data.members.length > 0 && ` · ${t.stats.liveMembersCount(data.members.length)}`}
        </span>
      </p>
      {/* Membres connectés : pseudo et photo seulement, jamais la page qu'ils regardent */}
      {data.members.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{t.stats.liveMembersTitle}</p>
          <ul className="flex flex-wrap gap-1.5">
            {data.members.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/users?id=${m.id}`} className="flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-2.5 text-xs font-semibold transition hover:bg-bg">
                  <span className="relative">
                    <UserAvatar name={m.username} src={m.avatarUrl} size={22} />
                    <span className="absolute -bottom-px -right-px h-2 w-2 rounded-full border border-card bg-ok" aria-hidden="true" />
                  </span>
                  {m.username}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.visitors === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.stats.liveEmpty}</p>
      ) : data.pages.length === 0 ? null : (
        <ul className="mt-4 space-y-1">
          {data.pages.map((p) => (
            <li key={p.path} className="relative flex items-center justify-between gap-2 overflow-hidden rounded-lg px-2 py-1.5 text-[13px]">
              <span className="absolute inset-y-0 left-0 rounded-lg bg-ok-bg" style={{ width: `${(p.visitors / max) * 100}%` }} aria-hidden="true" />
              <span className="relative truncate">{p.path}</span>
              <span className="relative font-bold">{p.visitors}</span>
            </li>
          ))}
        </ul>
      )}
      {open && <LiveGlobeModal onClose={closeModal} />}
    </section>
  );
}
