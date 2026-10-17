import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { CATEGORIES } from "@/lib/catalog";
import { catalogHref, type CatalogFilters, type PriceType } from "@/lib/catalog-filters";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PriceRange } from "./PriceRange";

// Colonne de filtres : catégories (une seule à la fois) et prix
export function CatalogSidebar({ filters, t }: { filters: CatalogFilters; t: Dictionary }) {
  const priceTypes: { value: PriceType; label: string }[] = [
    { value: "", label: t.catalog.priceAll },
    { value: "free", label: t.catalog.free },
    { value: "paid", label: t.catalog.paid },
  ];

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{t.catalog.categories}</p>
        <nav className="space-y-0.5">
          <CategoryLink href={catalogHref(filters, { category: "" })} active={!filters.category}>
            <LayoutGrid className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} aria-hidden="true" />
            {t.catalog.all}
          </CategoryLink>
          {CATEGORIES.map((c) => (
            <CategoryLink key={c.id} href={catalogHref(filters, { category: c.id })} active={filters.category === c.id}>
              <CategoryIcon category={c.id} className="h-[18px] w-[18px] shrink-0" />
              {c.label}
            </CategoryLink>
          ))}
        </nav>
      </div>

      <div>
        <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{t.catalog.price}</p>
        <div className="space-y-2.5 px-1">
          {/* Tous / Gratuit / Payant */}
          <div className="flex rounded-lg bg-surface p-0.5">
            {priceTypes.map((p) => (
              <Link
                key={p.value || "all"}
                href={catalogHref(filters, { price: p.value })}
                scroll={false}
                aria-current={filters.price === p.value ? "true" : undefined}
                className={`flex-1 rounded-md py-1.5 text-center text-sm font-medium transition ${
                  filters.price === p.value ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </div>
          {/* Fourchette de prix (inutile si on ne veut que du gratuit) */}
          {filters.price !== "free" && <PriceRange filters={filters} />}
        </div>
      </div>
    </div>
  );
}

function CategoryLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
        active ? "bg-accent-soft font-semibold text-text" : "text-muted hover:bg-card hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}
