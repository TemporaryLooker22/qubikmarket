"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { ANNOUNCE_BANNER_COOKIE, ANNOUNCE_MODAL_COOKIE } from "@/lib/announce";

function remember(name: string) {
  try {
    document.cookie = `${name}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {}
}

// Fine bande en haut du site qui présente les projets sur mesure, avec une croix pour la masquer
export function ProjectsBanner() {
  const { t } = useI18n();
  const s = t.projects;
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="border-b border-border bg-surface/60">
      <div className="container-q flex min-h-9 items-center gap-2 py-1.5 text-xs sm:text-[13px]">
        <p className="flex min-w-0 flex-1 items-center justify-center gap-x-2 text-center leading-snug">
          <span className="hidden shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text sm:inline">{s.announceNew}</span>
          <span className="min-w-0 text-muted">
            {s.announceText}{" "}
            <Link href="/projects" className="inline-flex items-center gap-0.5 whitespace-nowrap font-semibold text-text hover:underline">
              {s.announceCta}
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </span>
        </p>
        <button
          type="button"
          aria-label={s.announceClose}
          title={s.announceClose}
          onClick={() => {
            remember(ANNOUNCE_BANNER_COOKIE);
            setOpen(false);
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-bg hover:text-text"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// Fenêtre de présentation des projets sur mesure, affichée une seule fois à chaque visiteur (connecté ou non)
export function ProjectsIntroModal() {
  const { t } = useI18n();
  const s = t.projects;
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const close = () => {
    remember(ANNOUNCE_MODAL_COOKIE);
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="projects-intro-title" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="animate-pop max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center gap-3 bg-text px-5 py-4 text-bg">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-text">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </span>
          <p id="projects-intro-title" className="flex-1 text-lg font-semibold leading-snug">
            {s.introTitle}
          </p>
          <button type="button" onClick={close} aria-label={s.introLater} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-bg/70 hover:bg-bg/10 hover:text-bg">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4 text-[15px] leading-relaxed">
          <p>{s.introLead}</p>
          <ol className="space-y-2.5">
            {s.how.map(([title, text], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-text">{i + 1}</span>
                <span className="min-w-0">
                  <span className="font-semibold">{title}.</span> <span className="text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="rounded-xl bg-bg px-4 py-3 text-sm">{s.introDevs}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className="h-10 rounded-xl px-4 text-sm font-semibold text-muted hover:bg-bg hover:text-text">
            {s.introLater}
          </button>
          <Link href="/projects" onClick={close} className="btn-accent h-10 justify-center rounded-xl px-5 text-sm">
            {s.introCta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
