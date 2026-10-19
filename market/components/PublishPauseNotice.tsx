"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { acknowledgePublishPause } from "@/app/member-actions";

// Fenêtre affichée à l'arrivée sur le site quand la modération a mis en pause les publications du membre.
// « J'ai compris » la ferme pour de bon (elle ne revient pas avant une nouvelle pause).
export function PublishPauseNotice({ until }: { until: string | null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(Boolean(until));
  const [, startTransition] = useTransition();
  useEffect(() => setOpen(Boolean(until)), [until]);
  if (!until || !open) return null;
  const s = t.publishPause;
  const close = () => {
    setOpen(false);
    startTransition(() => acknowledgePublishPause());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="publish-pause-title">
      <div className="animate-pop w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center gap-3 bg-text px-5 py-4 text-bg">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-text">
            <Clock className="h-5 w-5" aria-hidden="true" />
          </span>
          <p id="publish-pause-title" className="text-lg font-semibold">
            {s.title}
          </p>
        </div>
        <div className="space-y-3 px-5 py-4 text-[15px] leading-relaxed">
          <p>{s.body(until)}</p>
          <p className="text-muted">{s.keep}</p>
        </div>
        <div className="flex justify-end border-t border-border px-5 py-3">
          <button type="button" onClick={close} className="btn-accent rounded-xl px-5 py-2.5 text-sm">
            {s.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
