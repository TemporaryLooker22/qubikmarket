import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { SearchX, Search, SlidersHorizontal, X } from "lucide-react";
import { db } from "@/lib/db";
import { categoryLabel } from "@/lib/catalog";
import { activeFilterCount, catalogHref, PAGE_SIZE, parseFilters, type CatalogFilters } from "@/lib/catalog-filters";
import { DEMO_ENABLED, DEMO_LATEST, type DemoResource } from "@/lib/demo";
import { getDictionary } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/dictionaries";
import { ResourceCard } from "@/components/ResourceCard";
import { CatalogSidebar } from "@/components/catalog/CatalogSidebar";
import { SortSelect } from "@/components/catalog/SortSelect";
import { after } from "next/server";
import { headers } from "next/headers";
import { botName, recordSearch } from "@/lib/analytics";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ t }, filters] = await Promise.all([getDictionary(), searchParams.then(parseFilters)]);
  return {
    title: filters.category ? categoryLabel(filters.category) : t.catalog.title,
    alternates: { canonical: filters.category ? `/resources?category=${filters.category}` : "/resources" },
  };
}

const euros = (v: string) => Math.round(Number(v) * 100);

// Conditions de recherche en base selon les filtres
function buildWhere(f: CatalogFilters): Prisma.ResourceWhereInput {
  const priceCents: Prisma.IntFilter = {};
  if (f.price === "free") priceCents.equals = 0;
  if (f.price === "paid") priceCents.gt = 0;
  if (f.price !== "free" && f.min) priceCents.gte = euros(f.min);
  if (f.price !== "free" && f.max) priceCents.lte = euros(f.max);
  return {
    status: "APPROVED",
    ...(f.category && { category: f.category }),
    ...(Object.keys(priceCents).length && { priceCents }),
    ...(f.q && {
      OR: [
        { title: { contains: f.q, mode: "insensitive" as const } },
        { summary: { contains: f.q, mode: "insensitive" as const } },
      ],
    }),
  };
}

const ORDER_BY: Record<CatalogFilters["sort"], Prisma.ResourceOrderByWithRelationInput[]> = {
  recent: [{ createdAt: "desc" }],
  popular: [{ purchases: { _count: "desc" } }, { createdAt: "desc" }],
  // Moyenne pondérée par le nombre d'avis (voir lib/reviews.ts) : les ressources sans avis à la fin
  "top-rated": [{ ratingScore: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }],
  "price-asc": [{ priceCents: "asc" }, { createdAt: "desc" }],
  "price-desc": [{ priceCents: "desc" }, { createdAt: "desc" }],
};

// Mode démo (voir lib/demo.ts) : on applique les mêmes filtres aux exemples, en mémoire
function filterDemo(f: CatalogFilters): DemoResource[] {
  const q = f.q.toLowerCase();
  const list = DEMO_LATEST.filter(
    (r) =>
      (!f.category || r.category === f.category) &&
      (f.price !== "free" || r.priceCents === 0) &&
      (f.price !== "paid" || r.priceCents > 0) &&
      (f.price === "free" || !f.min || r.priceCents >= euros(f.min)) &&
      (f.price === "free" || !f.max || r.priceCents <= euros(f.max)) &&
      (!q || r.title.toLowerCase().includes(q)),
  );
  if (f.sort === "popular") list.sort((a, b) => b.sales - a.sales);
  if (f.sort === "price-asc") list.sort((a, b) => a.priceCents - b.priceCents);
  if (f.sort === "price-desc") list.sort((a, b) => b.priceCents - a.priceCents);
  return list;
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale, t }, filters] = await Promise.all([getDictionary(), searchParams.then(parseFilters)]);

  const where = buildWhere(filters);
  const [realTotal, realResources, anyResource] = await Promise.all([
    db.resource.count({ where }),
    db.resource.findMany({ where, orderBy: ORDER_BY[filters.sort], take: filters.limit, include: { seller: { select: { username: true } } } }),
    db.resource.count({ where: { status: "APPROVED" } }),
  ]);

  // Exemples de démo tant que le site n'a aucune vraie ressource (jamais en production)
  const demo = DEMO_ENABLED && anyResource === 0;
  const demoList = demo ? filterDemo(filters) : [];
  const resources = demo ? demoList.slice(0, filters.limit) : realResources;
  const total = demo ? demoList.length : realTotal;
  // Statistiques : ce que les gens cherchent, et combien de résultats ils trouvent (robots exclus)
  if (filters.q && !demo) {
    const requestHeaders = new Headers(await headers());
    if (!botName(requestHeaders.get("user-agent") ?? "")) after(() => recordSearch(requestHeaders, filters.q, total).catch(() => {}));
  }

  const heading = filters.category ? categoryLabel(filters.category) : t.catalog.title;
  const filterCount = activeFilterCount(filters);

  return (
    <div className="full-bleed container-q pt-8">
      <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* Filtres (ordinateur) */}
        <aside className="hidden md:block">
          <div className="sticky top-24">
            <CatalogSidebar filters={filters} t={t} />
          </div>
        </aside>

        <div className="min-w-0">
          {/* En-tête : titre de la catégorie + nombre de résultats */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{heading}</h1>
            <span className="text-sm text-muted">{t.catalog.results(total)}</span>
          </div>

          {/* Recherche (on valide avec Entrée), puis Filtres (mobile) et Tri */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <form action="/resources" role="search" className="min-w-0 sm:flex-1">
              {filters.category && <input type="hidden" name="category" value={filters.category} />}
              {filters.price && <input type="hidden" name="price" value={filters.price} />}
              {filters.min && <input type="hidden" name="min" value={filters.min} />}
              {filters.max && <input type="hidden" name="max" value={filters.max} />}
              {filters.sort !== "recent" && <input type="hidden" name="sort" value={filters.sort} />}
              <label className="flex h-11 items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 transition focus-within:border-text">
                <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="sr-only">{t.nav.search}</span>
                <input
                  key={filters.q}
                  name="q"
                  type="search"
                  defaultValue={filters.q}
                  placeholder={filters.category ? t.catalog.searchIn(heading) : t.catalog.searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                />
              </label>
            </form>
            <div className="relative flex gap-2">
              {/* Filtres (mobile) : la même colonne, dans un panneau qui s'ouvre par-dessus les résultats */}
              <details className="group flex-1 md:hidden">
                <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  {t.catalog.filters}
                  {filterCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold">{filterCount}</span>
                  )}
                </summary>
                <div className="animate-pop absolute inset-x-0 top-full z-10 mt-2 origin-top rounded-xl border border-border bg-card p-3 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)] sm:left-auto sm:w-72">
                  <CatalogSidebar filters={filters} t={t} />
                </div>
              </details>
              <SortSelect filters={filters} className="flex-1 sm:flex-none" />
            </div>
          </div>

          {/* Filtres actifs, retirables d'un clic */}
          <ActiveFilters filters={filters} locale={locale} t={t} />

          {/* Résultats */}
          {resources.length > 0 ? (
            <>
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {resources.map((r, i) => (
                  <div key={r.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i % PAGE_SIZE, 12) * 35}ms` }}>
                    <ResourceCard resource={r} locale={locale} />
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-col items-center gap-3">
                <p className="text-xs text-muted">{t.catalog.showing(resources.length, total)}</p>
                {resources.length < total && (
                  <Link href={catalogHref(filters, { limit: filters.limit + PAGE_SIZE })} scroll={false} className="btn-ghost bg-card px-6">
                    {t.catalog.loadMore}
                  </Link>
                )}
              </div>
            </>
          ) : (
            <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-card px-6 py-16 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
                <SearchX className="h-6 w-6" aria-hidden="true" />
              </span>
              <h2 className="mt-4 font-semibold">{t.catalog.emptyTitle}</h2>
              <p className="mt-1 max-w-sm text-sm text-muted">{t.catalog.emptyText}</p>
              {filterCount > 0 && (
                <Link href="/resources" className="btn mt-5">
                  {t.catalog.reset}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveFilters({ filters, locale, t }: { filters: CatalogFilters; locale: Locale; t: Awaited<ReturnType<typeof getDictionary>>["t"] }) {
  const chips: { label: string; href: string }[] = [];
  if (filters.q) chips.push({ label: `“${filters.q}”`, href: catalogHref(filters, { q: "" }) });
  if (filters.category) chips.push({ label: categoryLabel(filters.category), href: catalogHref(filters, { category: "" }) });
  if (filters.price) chips.push({ label: filters.price === "free" ? t.catalog.free : t.catalog.paid, href: catalogHref(filters, { price: "" }) });
  if (filters.price !== "free" && (filters.min || filters.max)) {
    const from = filters.min ? formatPrice(euros(filters.min), locale) : "0";
    const to = filters.max ? formatPrice(euros(filters.max), locale) : "∞";
    chips.push({ label: `${from} – ${to}`, href: catalogHref(filters, { min: "", max: "" }) });
  }
  if (!chips.length) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          scroll={false}
          aria-label={t.catalog.remove(c.label)}
          className="animate-pop inline-flex items-center gap-1.5 rounded-full bg-text py-1 pl-3 pr-2 text-xs font-medium text-bg transition hover:bg-text/80"
        >
          {c.label}
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ))}
      <Link href="/resources" scroll={false} className="px-1 text-xs font-medium text-muted underline underline-offset-2 hover:text-text">
        {t.catalog.clearAll}
      </Link>
    </div>
  );
}
