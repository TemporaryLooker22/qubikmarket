import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { categoryLabel } from "@/lib/catalog";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/format";
import { CategoryIcon } from "@/components/CategoryIcon";

export type HeroCard = { title: string; category: string; priceCents: number; image?: string; sales?: number };

// Haut de la page vendeur : trois cartes produit inclinées qui flottent doucement (illustration)
const POSITIONS = [
  "left-0 top-10 w-[46%] -rotate-[8deg]",
  "right-0 top-2 w-[46%] rotate-[7deg]",
  "left-1/2 top-[34%] z-10 w-[56%] -translate-x-1/2",
];

export function HeroCards({ cards, locale }: { cards: HeroCard[]; locale: Locale }) {
  const t = dictionaries[locale];
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-lg" aria-hidden="true">
      <span className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 rounded-full bg-card px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted shadow-sm">
        {t.seller.example}
      </span>
      {cards.slice(0, 3).map((card, i) => (
        // L'inclinaison est sur le conteneur, le flottement sur la carte (sinon les deux transformations s'annulent)
        <div key={card.title} className={`absolute ${POSITIONS[i]}`}>
          <div className="animate-float rounded-2xl border border-border bg-card p-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.4)]" style={{ animationDelay: `${i * 0.6}s` }}>
            <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-surface text-muted">
              {card.image ? (
                <Image src={card.image} alt="" fill sizes="280px" className="object-cover" />
              ) : (
                <CategoryIcon category={card.category} className="h-10 w-10" />
              )}
              <span className="absolute bottom-2 right-2 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-text shadow-sm">
                {formatPrice(card.priceCents, locale)}
              </span>
            </div>
            <div className="px-1.5 pb-1 pt-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{categoryLabel(card.category)}</p>
              <p className="truncate text-sm font-semibold">{card.title}</p>
              <p className="mt-1 flex items-center gap-1 overflow-hidden whitespace-nowrap text-xs font-medium text-ok">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                {t.seller.cleanScan}
                {card.sales !== undefined && <span className="text-muted">· {t.card.sales(card.sales)}</span>}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
