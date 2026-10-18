import Image from "next/image";
import Link from "next/link";
import { categoryLabel } from "@/lib/catalog";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/format";
import { Star } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";

type Props = {
  resource: {
    slug: string;
    title: string;
    category: string;
    priceCents: number;
    image?: string; // miniature 16:9 (exemples de démo)
    images?: string[]; // captures d'écran des vraies ressources : la première sert de miniature
    seller: { username: string };
    ratingAvg?: number; // note moyenne des avis (vraies ressources)
    ratingCount?: number;
  };
  href?: string; // lien de la carte (par défaut : la page de la ressource)
  locale: Locale;
  // "large" : la grande carte du bandeau Game Setups, "compact" : les petites cartes à côté
  size?: "normal" | "large" | "compact";
  rank?: number; // position dans le classement des ventes (#1, #2…)
  sales?: number; // nombre de ventes à afficher
};

const formatRating = (n: number, locale: Locale) => n.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const THUMB_SIZES = { normal: "aspect-video", large: "min-h-48 flex-1", compact: "h-28" };

export function ResourceCard({ resource, locale, href, size = "normal", rank, sales }: Props) {
  const t = dictionaries[locale];
  const large = size === "large";
  const free = resource.priceCents === 0;
  const thumbnail = resource.image ?? resource.images?.[0];
  return (
    <Link
      href={href ?? `/resources/${resource.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-2 transition duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]"
    >
      {/* Vignette : la miniature si elle existe, sinon l'icône de la catégorie */}
      <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-surface text-muted ${THUMB_SIZES[size]}`}>
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes={large ? "(min-width: 768px) 66vw, 100vw" : "260px"}
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <CategoryIcon
            category={resource.category}
            className={`transition duration-500 group-hover:-rotate-6 group-hover:scale-110 group-hover:text-text ${large ? "h-12 w-12" : "h-9 w-9"}`}
          />
        )}
        {rank && (
          <span className="absolute left-2 top-2 flex h-7 min-w-7 shadow-sm items-center justify-center rounded-full bg-text px-2 text-xs font-bold text-bg">
            #{rank}
          </span>
        )}
        <span
          className={`absolute bottom-2 right-2 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${free ? "bg-card text-text" : "bg-accent text-text"}`}
        >
          {formatPrice(resource.priceCents, locale)}
        </span>
      </div>
      <div className="px-1.5 pb-1.5 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{categoryLabel(resource.category)}</p>
        <p className={`mt-0.5 truncate font-semibold ${large ? "text-lg" : "text-[15px]"}`}>{resource.title}</p>
        <p className="mt-1 flex items-center justify-between gap-2 truncate text-xs text-muted">
          <span className="truncate">{t.card.by(resource.seller.username)}</span>
          {resource.ratingCount ? (
            <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-text" aria-label={t.resource.rating(formatRating(resource.ratingAvg ?? 0, locale))}>
              <Star className="h-3.5 w-3.5 text-accent" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              {formatRating(resource.ratingAvg ?? 0, locale)}
              <span className="font-normal text-muted">({resource.ratingCount})</span>
            </span>
          ) : null}
          {sales !== undefined && <span className="shrink-0 font-medium text-text">{t.card.sales(sales)}</span>}
        </p>
      </div>
    </Link>
  );
}
