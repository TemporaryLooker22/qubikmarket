"use client";

import { Check } from "lucide-react";
import { categoryLabel } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount, formatPrice } from "@/lib/i18n/format";
import { CategoryIcon } from "@/components/CategoryIcon";

export type ChecklistItem = { label: string; ok: boolean; note?: string };

type Props = {
  preview: { title: string; category: string; priceCents: number; paid: boolean; image?: string; seller: string };
  checks: ChecklistItem[];
};

// Colonne de droite du formulaire de vente : aperçu de la carte, liste « prêt à publier », suite des événements
export function SellAside({ preview, checks }: Props) {
  const { t, locale } = useI18n();
  const done = checks.filter((c) => c.ok).length;
  // En mode « Payant » sans prix saisi, on affiche 0,00 € plutôt que « Gratuit »
  const free = !preview.paid;

  return (
    <aside className="lg:sticky lg:top-24">
      {/* Aperçu en direct de la carte du catalogue (masqué sur téléphone) */}
      <div className="hidden lg:block">
        <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">{t.sell.previewCard}</h2>
        <div className="rounded-2xl border border-border bg-card p-2 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-surface text-muted">
            {preview.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <CategoryIcon category={preview.category} className="h-9 w-9" />
            )}
            <span className={`absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${free ? "bg-card" : "bg-accent"}`}>
              {free ? formatPrice(0, locale) : formatAmount(preview.priceCents, locale)}
            </span>
          </div>
          <div className="px-1.5 pb-1.5 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{preview.category ? categoryLabel(preview.category) : "—"}</p>
            <p className={`mt-0.5 truncate text-[15px] font-semibold ${preview.title ? "" : "text-muted"}`}>{preview.title || t.sell.titlePlaceholder}</p>
            <p className="mt-1 truncate text-xs text-muted">{t.card.by(preview.seller)}</p>
          </div>
        </div>
      </div>

      {/* Ce qu'il reste à remplir */}
      <div className="rounded-2xl border border-border bg-card p-4 lg:mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t.sell.checklist}</h2>
          <span className="text-sm text-muted">
            {done} / {checks.length}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(done / checks.length) * 100}%` }} />
        </div>
        <ul className="mt-3 space-y-1.5">
          {checks.map((c) => (
            <li key={c.label} className={`flex items-center gap-2.5 text-[13px] ${c.ok ? "text-text" : "text-muted"}`}>
              <span
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                  c.ok ? "border-text bg-text text-accent" : "border-border-strong"
                }`}
              >
                {c.ok && <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />}
              </span>
              {c.label}
              {!c.ok && c.note && <span className="ml-auto text-[11px]">{c.note}</span>}
            </li>
          ))}
        </ul>
      </div>

      {/* Rappel : ce qui se passe après la publication */}
      <div className="mt-5 hidden px-1 lg:block">
        <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">{t.sell.nextTitle}</h2>
        {t.sell.next.map((step, i) => (
          <p key={step.label} className="mb-2 flex gap-2.5 text-[13px] text-muted">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${["bg-ok", "bg-accent-hover", "bg-bad"][i]}`} />
            <span>
              <span className="font-semibold text-text">{step.label}</span> {step.text}
            </span>
          </p>
        ))}
      </div>
    </aside>
  );
}
