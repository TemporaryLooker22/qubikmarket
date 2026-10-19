"use client";

import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/i18n/format";
import { Megaphone } from "lucide-react";
import { PROMO_MAX, promoLevel } from "@/lib/promotion-shared";

// Mêmes limites que le serveur (app/actions.ts)
export const PRICE = { min: 1, max: 500 };

// Prix saisi → centimes, et s'il est acceptable (gratuit, ou entre 1 € et 500 €)
export function parsePrice(paid: boolean, price: string) {
  const priceCents = paid ? Math.round((Number(price) || 0) * 100) : 0;
  const priceOk = !paid || (priceCents >= PRICE.min * 100 && priceCents <= PRICE.max * 100);
  return { priceCents, priceOk };
}

// Gratuit / Payant, prix et estimation des gains (mise en vente et modification d'une ressource)
export function PriceField({
  paid,
  onPaidChange,
  price,
  onPriceChange,
  feePercent,
  promo,
  onPromoChange,
  inputClass,
}: {
  paid: boolean;
  onPaidChange: (paid: boolean) => void;
  price: string;
  onPriceChange: (price: string) => void;
  feePercent: number; // commission normale du vendeur
  promo: number; // commission choisie (de feePercent à PROMO_MAX) : au-dessus, la ressource est mise en avant
  onPromoChange: (promo: number) => void;
  inputClass: string;
}) {
  const { t, locale } = useI18n();
  const { priceCents } = parsePrice(paid, price);
  const fee = Math.max(feePercent, Math.min(PROMO_MAX, promo));
  // Estimation avec la TVA belge (21 %) : le vrai calcul se fait à chaque vente (lib/earnings.ts)
  const taxCents = priceCents - Math.round(priceCents / 1.21);
  const feeCents = Math.round(((priceCents - taxCents) * fee) / 100);
  const level = promoLevel(feePercent, fee);

  return (
    <>
      <div role="radiogroup" aria-label={t.sell.priceTitle} className="inline-flex gap-1 rounded-xl bg-surface p-1">
        {[false, true].map((isPaid) => (
          <button
            key={String(isPaid)}
            type="button"
            role="radio"
            aria-checked={paid === isPaid}
            onClick={() => onPaidChange(isPaid)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${paid === isPaid ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"}`}
          >
            {isPaid ? t.sell.paid : t.sell.free}
          </button>
        ))}
      </div>
      {paid ? (
        <>
          <div className="mt-4 flex flex-wrap items-stretch gap-4">
            <div className="relative w-40">
              <input
                name="price"
                type="number"
                inputMode="decimal"
                required
                min={PRICE.min}
                max={PRICE.max}
                step="0.01"
                value={price}
                onChange={(e) => onPriceChange(e.target.value)}
                placeholder="4.99"
                aria-label={t.sell.priceTitle}
                className={`${inputClass} h-12 pr-9 text-lg font-bold`}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted">€</span>
            </div>
            <div className="flex min-w-56 flex-1 flex-col justify-center rounded-xl bg-accent-soft px-4 py-2">
              <p className="text-lg font-bold">{t.sell.earn(formatAmount(priceCents - taxCents - feeCents, locale))}</p>
              <p className="text-xs text-text/70">{t.sell.earnDetail(fee, formatAmount(taxCents, locale))}</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-muted">{t.sell.priceHelp}</p>

          {/* Mise en avant : le vendeur laisse un plus grand pourcentage à Qubik pour être mis en avant */}
          <div className="mt-5 rounded-xl border border-border p-4">
            <input type="hidden" name="promo" value={fee} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <Megaphone className="h-4 w-4" aria-hidden="true" />
                {t.promo.title}
              </p>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${level ? "bg-accent text-text" : "bg-surface text-muted"}`}>
                {level ? t.promo.level(level) : t.promo.off}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{t.promo.help(feePercent, PROMO_MAX)}</p>
            <label className="mt-4 block">
              <span className="sr-only">{t.promo.title}</span>
              <input
                type="range"
                min={feePercent}
                max={PROMO_MAX}
                step={1}
                value={fee}
                onChange={(e) => onPromoChange(Number(e.target.value))}
                className="w-full accent-[#0b0b0b]"
              />
            </label>
            <div className="mt-1 flex justify-between text-xs text-muted">
              <span>{t.promo.normal(feePercent)}</span>
              <span className="font-bold text-text">{t.promo.chosen(fee)}</span>
              <span>{PROMO_MAX}{locale === "fr" ? " %" : "%"}</span>
            </div>
            <p className="mt-2 text-xs text-muted">{level ? t.promo.onNote : t.promo.offNote}</p>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted">{t.sell.freeHelp}</p>
          <p className="mt-1.5 text-xs text-muted">{t.promo.freeNote}</p>
        </>
      )}
    </>
  );
}
