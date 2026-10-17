"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowUpDown } from "lucide-react";
import { catalogHref, SORTS, type CatalogFilters, type Sort } from "@/lib/catalog-filters";
import { useI18n } from "@/lib/i18n/client";

// Menu de tri : change l'adresse dès qu'on choisit une option
export function SortSelect({ filters, className = "" }: { filters: CatalogFilters; className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const labels: Record<Sort, string> = {
    recent: t.catalog.sortRecent,
    popular: t.catalog.sortPopular,
    "price-asc": t.catalog.sortPriceAsc,
    "price-desc": t.catalog.sortPriceDesc,
  };

  return (
    <label className={`relative flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-card pl-3 pr-2 text-sm transition focus-within:border-text ${pending ? "opacity-60" : ""} ${className}`}>
      <ArrowUpDown className="h-4 w-4 text-muted" aria-hidden="true" />
      <span className="sr-only">{t.catalog.sort}</span>
      <select
        value={filters.sort}
        onChange={(e) => startTransition(() => router.push(catalogHref(filters, { sort: e.target.value as Sort }), { scroll: false }))}
        className="min-w-0 flex-1 cursor-pointer appearance-none bg-transparent pr-5 font-medium outline-none"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {labels[s]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-xs text-muted" aria-hidden="true">
        ▾
      </span>
    </label>
  );
}
