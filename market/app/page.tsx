import Link from "next/link";
import { ArrowRight, Download, Plus, ScanSearch, Search, ShieldCheck, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/format";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Gallery } from "@/components/Gallery";
import { ResourceCard } from "@/components/ResourceCard";

export const dynamic = "force-dynamic";

// Les chiffres clés restent cachés tant que le site n'a pas assez de ressources (pour ne pas afficher « 0 vendeur »)
const SHOW_STATS_FROM = 100;
// « Les plus vendues en ce moment » : ventes des 30 derniers jours
const BEST_SELLERS_DAYS = 30;
const GALLERY_SIZE = 10;

const sellerSelect = { seller: { select: { username: true } } };

// Classement des ressources par nombre d'achats payés (ou obtenus gratuitement), avec le nombre de ventes
async function getBestSellers(since?: Date) {
  const top = await db.purchase.groupBy({
    by: ["resourceId"],
    where: { status: "PAID", resource: { status: "APPROVED" }, ...(since && { createdAt: { gte: since } }) },
    _count: { resourceId: true },
    orderBy: { _count: { resourceId: "desc" } },
    take: GALLERY_SIZE,
  });
  const byId = new Map(
    (await db.resource.findMany({ where: { id: { in: top.map((t) => t.resourceId) } }, include: sellerSelect })).map((r) => [r.id, r]),
  );
  return top.flatMap((t) => {
    const resource = byId.get(t.resourceId);
    return resource ? [{ resource, sales: t._count.resourceId }] : [];
  });
}

export default async function HomePage() {
  const since = new Date(Date.now() - BEST_SELLERS_DAYS * 24 * 3600 * 1000);
  const [{ locale, t }, recentBestSellers, latest, featured, stats] = await Promise.all([
    getDictionary(),
    getBestSellers(since),
    db.resource.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: GALLERY_SIZE,
      include: sellerSelect,
    }),
    // Game Setups à la une : les plus récents
    db.resource.findMany({
      where: { status: "APPROVED", category: "game-setups" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: sellerSelect,
    }),
    Promise.all([
      db.resource.count(),
      db.resource.count({ where: { status: "REJECTED" } }),
      db.user.count({ where: { resources: { some: { status: "APPROVED" } } } }),
    ]),
  ]);
  // Pas de vente ces 30 derniers jours : on se rabat sur le classement de tous les temps
  const bestSellers = recentBestSellers.length ? recentBestSellers : await getBestSellers();

  const [scannedCount, blockedCount, sellerCount] = stats;
  const [mainSetup, ...otherSetups] = featured;

  return (
    <div className="full-bleed">
      {/* 1. Recherche */}
      <section className="container-q pb-10 pt-14 text-center sm:pb-12 sm:pt-20">
        <h1 className="animate-fade-up text-3xl font-semibold tracking-tight sm:text-5xl">
          {t.home.titleStart} <span className="highlight">{t.home.titleHighlight}</span>
          {t.home.titleEnd && ` ${t.home.titleEnd}`}
        </h1>
        {/* Recherche minimaliste : un seul champ, on valide avec Entrée */}
        <form action="/resources" role="search" className="animate-fade-up mx-auto mt-8 max-w-lg" style={{ animationDelay: "120ms" }}>
          <label className="flex items-center gap-3 rounded-full border border-border bg-card px-5 transition focus-within:border-text focus-within:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.2)]">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
            <span className="sr-only">{t.home.searchLabel}</span>
            <input
              name="q"
              type="search"
              placeholder={t.home.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-muted"
            />
          </label>
        </form>
        <p className="animate-fade-up mt-4 inline-flex items-center gap-1.5 text-sm text-muted" style={{ animationDelay: "200ms" }}>
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> {t.home.scannedNote}
        </p>
      </section>

      {/* 2. Catégories : juste sous la recherche, visibles sans défiler */}
      <section className="container-q">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {CATEGORIES.map((c, i) => (
            <Link
              key={c.id}
              href={`/resources?category=${c.id}`}
              style={{ animationDelay: `${250 + i * 50}ms` }}
              className="animate-fade-up group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-2 py-5 text-center transition duration-300 hover:-translate-y-1 hover:border-accent hover:bg-accent-soft hover:shadow-[0_12px_28px_-14px_rgba(0,0,0,0.25)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg transition duration-300 group-hover:rotate-[-8deg] group-hover:scale-110 group-hover:bg-accent">
                <CategoryIcon category={c.id} className="h-[22px] w-[22px]" />
              </span>
              <span className="text-sm font-semibold">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Les plus vendues en ce moment (cachée tant qu'il n'y a aucune vente) */}
      {bestSellers.length > 0 && (
        <section className="reveal container-q mt-16">
          <SectionTitle title={t.home.bestSellers} subtitle={t.home.bestSellersSub} href="/resources" seeAll={t.home.seeAll} />
          <Gallery>
            {bestSellers.map(({ resource, sales }, i) => (
              <ResourceCard key={resource.id} resource={resource} locale={locale} rank={i + 1} sales={sales} />
            ))}
          </Gallery>
        </section>
      )}

      {/* 4. Les plus récentes (cachée tant qu'il n'y a aucune ressource) */}
      {latest.length > 0 && (
        <section className="reveal container-q mt-12">
          <SectionTitle title={t.home.latest} subtitle={t.home.latestSub} href="/resources" seeAll={t.home.seeAll} />
          <Gallery>
            {latest.map((r) => (
              <ResourceCard key={r.id} resource={r} locale={locale} />
            ))}
          </Gallery>
        </section>
      )}

      {/* 5. Game Setups à la une (caché s'il n'y en a aucun) */}
      {mainSetup && (
        <section className="reveal mt-16 bg-surface py-12">
          <div className="container-q">
            <SectionTitle title={t.home.setupsTitle} subtitle={t.home.setupsSub} href="/resources?category=game-setups" seeAll={t.home.seeAll} />
            <div className={`grid gap-4 ${otherSetups.length ? "md:grid-cols-[2fr_1fr]" : ""}`}>
              <ResourceCard resource={mainSetup} locale={locale} size="large" />
              {otherSetups.length > 0 && (
                <div className="grid gap-4">
                  {otherSetups.map((r) => (
                    <ResourceCard key={r.id} resource={r} locale={locale} size="compact" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 6. Comment ça marche */}
      <section className="mt-16 bg-surface py-12">
        <div className="reveal container-q">
          <SectionTitle title={t.home.howTitle} />
          <ol className="grid gap-8 sm:grid-cols-3">
            {[Upload, ScanSearch, Download].map((Icon, i) => (
              <li key={i}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-text">
                    <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                  </span>
                  <span className="text-sm text-muted">{t.home.step(i + 1)}</span>
                </div>
                <h3 className="mt-4 font-medium">{t.home.steps[i].title}</h3>
                <p className="mt-1 text-sm text-muted">{t.home.steps[i].text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 7. Chiffres clés (cachés au lancement, voir SHOW_STATS_FROM) */}
      {scannedCount >= SHOW_STATS_FROM && (
        <section className="reveal container-q mt-16">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={t.home.stats.scanned} value={formatNumber(scannedCount, locale)} />
            <Stat label={t.home.stats.blocked} value={formatNumber(blockedCount, locale)} />
            <Stat label={t.home.stats.sellers} value={formatNumber(sellerCount, locale)} />
          </div>
        </section>
      )}

      {/* 8. FAQ — TODO : ajouter une question sur le remboursement une fois la politique décidée */}
      <section className="reveal container-q mt-16">
        <SectionTitle title={t.home.faqTitle} />
        <div className="max-w-3xl divide-y divide-border border-y border-border">
          {t.home.faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="h-4 w-4 shrink-0 transition duration-300 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="animate-fade-up mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, subtitle, href, seeAll }: { title: string; subtitle?: string; href?: string; seeAll?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted hover:text-text">
          {seeAll} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
