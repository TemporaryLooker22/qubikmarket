"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type Live = { visitors: number; pages: { path: string; visitors: number }[] };

// « En ce moment » : visiteurs des 5 dernières minutes, actualisé toutes les 15 s
export function LiveCard({ initial }: { initial: Live }) {
  const { t } = useI18n();
  const [data, setData] = useState(initial);
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
        <span className="text-xs text-muted">{t.stats.liveNote}</span>
      </div>
      <p className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className={`absolute inline-flex h-full w-full rounded-full bg-ok opacity-60 ${data.visitors ? "animate-ping" : ""}`} />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-ok" />
        </span>
        <span className="text-4xl font-extrabold tracking-tight">{data.visitors}</span>
        <span className="text-sm text-muted">{t.stats.liveVisitors(data.visitors)}</span>
      </p>
      {data.pages.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t.stats.liveEmpty}</p>
      ) : (
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
    </section>
  );
}
