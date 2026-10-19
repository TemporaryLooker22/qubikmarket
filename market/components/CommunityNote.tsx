"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/i18n/format";

type Counts = { members: number; sellers: number; earnedCents: number };

const REFRESH_MS = 15_000;

// Ligne « membres · vendeurs · gagnés par les vendeurs » de l'accueil : se met à jour toute seule
// (nouveaux membres, nouveaux vendeurs, nouvelles ventes) sans recharger la page, et clignote quand un chiffre change
export function CommunityNote({ initial }: { initial: Counts }) {
  const { t, locale } = useI18n();
  const [counts, setCounts] = useState(initial);
  const [flash, setFlash] = useState(false);
  const last = useRef(initial);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/community", { cache: "no-store" });
        if (!res.ok || stopped) return;
        const next: Counts = await res.json();
        const prev = last.current;
        if (next.members !== prev.members || next.sellers !== prev.sellers || next.earnedCents !== prev.earnedCents) {
          last.current = next;
          setCounts(next);
          setFlash(true);
          setTimeout(() => !stopped && setFlash(false), 1200);
        }
      } catch {
        // hors ligne : on réessaiera au prochain tour
      }
    };
    const timer = setInterval(load, REFRESH_MS);
    // Retour sur l'onglet : on rafraîchit tout de suite
    document.addEventListener("visibilitychange", load);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 transition-colors duration-700 ${flash ? "bg-accent-soft text-text" : ""}`} aria-live="polite">
      <Users className="h-4 w-4" aria-hidden="true" />
      {t.home.communityNote(counts.members, counts.sellers, formatAmount(counts.earnedCents, locale))}
    </span>
  );
}
