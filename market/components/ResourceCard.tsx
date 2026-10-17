import Image from "next/image";
import Link from "next/link";
import { categoryLabel } from "@/lib/catalog";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { formatPrice } from "@/lib/i18n/format";
import { CategoryIcon } from "./CategoryIcon";

type Props = {
  resource: {
    slug: string;
    title: string;
    category: string;
    priceCents: number;
    image?: string; // miniature 16:9 (pour l'instant, seulement les exemples de démo)
    seller: { username: string };
  };
  href?: string; // lien de la carte (par défaut : la page de la ressource)
  locale: Locale;
  // "large" : la grande carte du bandeau Game Setups, "compact" : les petites cartes à côté
  size?: "normal" | "large" | "compact";
  rank?: number; // position dans le classement des ventes (#1, #2…)
  sales?: number; // nombre de ventes à afficher
};

const THUMB_SIZES = { normal: "aspect-video", large: "min-h-48 flex-1", compact: "h-28" };

export function ResourceCard({ resource, locale, href, size = "normal", rank, sales }: Props) {
  const t = dictionaries[locale];
  const large = size === "large";
  const free = resource.priceCents === 0;
  return (
    <Link
      href={href ?? `/resources/${resource.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-2 transition duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.18)]"
    >
      {/* Vignette : la miniature si elle existe, sinon l'icône de la catégorie */}
      <div className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-surface text-muted ${THUMB_SIZES[size]}`}>
        {resource.image ? (
          <Image
            src={resource.image}
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
          {sales !== undefined && <span className="shrink-0 font-medium text-text">{t.card.sales(sales)}</span>}
        </p>
      </div>
    </Link>
  );
}
