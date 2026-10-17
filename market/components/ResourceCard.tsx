import Link from "next/link";
import { categoryLabel, formatPrice } from "@/lib/catalog";
import { CategoryIcon } from "./CategoryIcon";

type Props = {
  resource: {
    slug: string;
    title: string;
    category: string;
    priceCents: number;
    seller: { username: string };
  };
  // "large" : la grande carte du bandeau Game Setups, "compact" : les petites cartes à côté
  size?: "normal" | "large" | "compact";
};

const THUMB_SIZES = { normal: "aspect-[4/3]", large: "min-h-48 flex-1", compact: "h-28" };

export function ResourceCard({ resource, size = "normal" }: Props) {
  const large = size === "large";
  return (
    <Link
      href={`/resources/${resource.slug}`}
      className="group flex h-full flex-col rounded-xl border border-border bg-bg p-2 transition hover:border-border-strong"
    >
      {/* Vignette : icône de la catégorie, en attendant les images des ressources */}
      <div
        className={`flex items-center justify-center rounded-lg bg-surface text-muted transition group-hover:bg-surface-2 ${THUMB_SIZES[size]}`}
      >
        <CategoryIcon category={resource.category} className={large ? "h-12 w-12" : "h-8 w-8"} />
      </div>
      <div className="px-1 pb-1 pt-3">
        <p className={`truncate font-medium ${large ? "text-lg" : "text-sm"}`}>{resource.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {categoryLabel(resource.category)} · par {resource.seller.username}
        </p>
        <p className={`mt-2 font-semibold ${large ? "text-base" : "text-sm"}`}>{formatPrice(resource.priceCents)}</p>
      </div>
    </Link>
  );
}
