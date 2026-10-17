"use client";

import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/i18n/format";

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
  inputClass,
}: {
  paid: boolean;
  onPaidChange: (paid: boolean) => void;
  price: string;
  onPriceChange: (price: string) => void;
  feePercent: number;
  inputClass: string;
}) {
  const { t, locale } = useI18n();
  const { priceCents } = parsePrice(paid, price);
  // Estimation avec la TVA belge (21 %) : le vrai calcul se fait à chaque vente (lib/earnings.ts)
  const taxCents = priceCents - Math.round(priceCents / 1.21);
  const feeCents = Math.round(((priceCents - taxCents) * feePercent) / 100);

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
              <p className="text-xs text-text/70">{t.sell.earnDetail(feePercent, formatAmount(taxCents, locale))}</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-muted">{t.sell.priceHelp}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">{t.sell.freeHelp}</p>
      )}
    </>
  );
}
