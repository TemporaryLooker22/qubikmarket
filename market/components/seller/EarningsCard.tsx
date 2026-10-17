"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/i18n/format";

// Carte « Revenus du mois » du haut de la page vendeur : un EXEMPLE illustratif (chiffres inventés),
// avec un compteur qui monte et des barres qui poussent
const TARGET_CENTS = 124860;
const BARS = [22, 38, 30, 55, 47, 72, 100];
const SALES = [
  { title: "Pet Collection System", cents: 1169 },
  { title: "Magic VFX Pack", cents: 269 },
  { title: "Tycoon Starter Kit", cents: 1349 },
];

export function EarningsCard() {
  const { locale, t } = useI18n();
  const [cents, setCents] = useState(0);

  // Le montant monte de 0 jusqu'au total en un peu plus d'une seconde
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCents(TARGET_CENTS);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1200);
      setCents(Math.round(TARGET_CENTS * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative rounded-3xl border border-border bg-card p-6 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.3)]">
      <span className="absolute right-5 top-5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
        {t.seller.example}
      </span>
      <p className="text-sm text-muted">{t.seller.monthRevenue}</p>
      <p className="mt-1 flex items-center gap-2 text-4xl font-bold tracking-tight tabular-nums">
        {formatAmount(cents, locale)}
        <span className="flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok">
          <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> +32 %
        </span>
      </p>

      {/* Ventes des 7 derniers jours */}
      <div className="mt-6 flex h-28 items-end gap-2" role="img" aria-label={t.seller.salesChart}>
        {BARS.map((h, i) => (
          <span
            key={i}
            className="animate-grow-y flex-1 rounded-t-md bg-accent"
            style={{ height: `${h}%`, animationDelay: `${200 + i * 80}ms`, opacity: 0.55 + (i / BARS.length) * 0.45 }}
          />
        ))}
      </div>

      <ul className="mt-5 space-y-2 border-t border-border pt-4">
        {SALES.map((sale, i) => (
          <li key={sale.title} className="animate-fade-up flex items-center justify-between text-sm" style={{ animationDelay: `${700 + i * 150}ms` }}>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
              {sale.title}
            </span>
            <span className="font-semibold tabular-nums">+{formatAmount(sale.cents, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
