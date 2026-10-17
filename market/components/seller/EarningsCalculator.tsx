"use client";

import { useState } from "react";
import { Crown } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/i18n/format";

// Calculateur : prix × ventes par mois, moins la commission de Qubik
export function EarningsCalculator({ feePercent, founderFeePercent }: { feePercent: number; founderFeePercent: number }) {
  const { locale, t } = useI18n();
  const [price, setPrice] = useState(9.99);
  const [sales, setSales] = useState(50);

  const gross = Math.round(price * 100) * sales;
  const earn = Math.round(gross * (1 - feePercent / 100));
  const earnFounder = Math.round(gross * (1 - founderFeePercent / 100));

  return (
    <div className="grid gap-8 rounded-3xl border border-border bg-card p-6 sm:p-8 md:grid-cols-[1.2fr_1fr] md:items-center">
      <div className="space-y-7">
        <Slider label={t.seller.calcPrice} value={formatAmount(Math.round(price * 100), locale)}>
          <input type="range" min={0.99} max={99.99} step={0.5} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="range-q" style={fill(price, 0.99, 99.99)} aria-label={t.seller.calcPrice} />
        </Slider>
        <Slider label={t.seller.calcSales} value={String(sales)}>
          <input type="range" min={1} max={500} step={1} value={sales} onChange={(e) => setSales(Number(e.target.value))} className="range-q" style={fill(sales, 1, 500)} aria-label={t.seller.calcSales} />
        </Slider>
      </div>

      <div className="rounded-2xl bg-text p-6 text-bg">
        <p className="text-sm text-bg/60">{t.seller.calcYouEarn}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums" aria-live="polite">
          {formatAmount(earn, locale)} <span className="text-base font-medium text-bg/60">{t.seller.calcPerMonth}</span>
        </p>
        <p className="mt-4 flex items-center gap-2 border-t border-bg/15 pt-4 text-sm">
          <Crown className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="text-bg/70">{t.seller.calcFounder(founderFeePercent)}</span>
          <span className="ml-auto font-semibold tabular-nums text-accent">{formatAmount(earnFounder, locale)}</span>
        </p>
        <p className="mt-3 text-xs text-bg/50">{t.seller.calcNote}</p>
      </div>
    </div>
  );
}

// Partie gauche du curseur remplie en noir jusqu'à la valeur choisie
function fill(value: number, min: number, max: number) {
  const pct = ((value - min) / (max - min)) * 100;
  return { background: `linear-gradient(to right, var(--color-text) ${pct}%, var(--color-surface-2) ${pct}%)` };
}

function Slider({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      {children}
    </div>
  );
}
