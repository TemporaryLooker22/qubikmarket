import Link from "next/link";
import { ArrowRight, Download, Plus, ScanSearch, Search, Store, Upload, Users } from "lucide-react";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatNumber } from "@/lib/i18n/format";
import { DEMO_BEST_SELLERS, DEMO_ENABLED, DEMO_LATEST } from "@/lib/demo";
import { getShowcaseImages } from "@/lib/showcase";
import { pickPromoted } from "@/lib/promotion";
import { DISCORD_URL, SITE_NAME, SITE_URL } from "@/lib/site";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Gallery } from "@/components/Gallery";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { ResourceCard } from "@/components/ResourceCard";

// Adresse de référence de l'accueil pour Google
export const metadata = { alternates: { canonical: "/" } };

// Données pour Google : l'organisation (nom, logo affiché dans les résultats), le site et sa recherche
const SITE_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-512.png`, width: 512, height: 512 }, sameAs: [DISCORD_URL] },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/resources?q={search_term_string}` }, "query-input": "required name=search_term_string" },
    },
  ],
};

export const dynamic = "force-dynamic";

// Les chiffres clés restent cachés tant que le site n'a pas assez de ressources (pour ne pas afficher « 0 vendeur »)
const SHOW_STATS_FROM = 100;
// « Les plus vendues en ce moment » : ventes des 30 derniers jours
const BEST_SELLERS_DAYS = 30;
const GALLERY_SIZE = 10;

const sellerSelect = { seller: { select: { username: true } } };

// Classement des ressources payantes par nombre de ventes payées (les ressources gratuites n'y figurent pas)
async function getBestSellers(since?: Date) {
  const top = await db.purchase.groupBy({
    by: ["resourceId"],
    where: { status: "PAID", amountCents: { gt: 0 }, resource: { status: "APPROVED", priceCents: { gt: 0 } }, ...(since && { createdAt: { gte: since } }) },
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
  const [{ locale, t }, recentBestSellers, latest, featured, stats, community] = await Promise.all([
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
    // Sous la recherche : membres, vendeurs (au moins une ressource en ligne) et gains des vendeurs (ventes non annulées)
    Promise.all([
      db.user.count({ where: { bannedAt: null } }),
      db.user.count({ where: { bannedAt: null, resources: { some: { status: "APPROVED" } } } }),
      db.sellerEarning.aggregate({ where: { purchaseId: { not: null }, status: { not: "CANCELED" } }, _sum: { amountCents: true } }),
    ]),
  ]);
  const [memberCount, activeSellers, earned] = community;
  // Pas de vente ces 30 derniers jours : on se rabat sur le classement de tous les temps
  const realBestSellers = recentBestSellers.length ? recentBestSellers : await getBestSellers();

  // Mode démo (maquette, voir lib/demo.ts) : des exemples tant qu'il n'y a pas de vraies données
  const bestSellers = realBestSellers.length || !DEMO_ENABLED ? realBestSellers : DEMO_BEST_SELLERS;
  const latestResources = latest.length || !DEMO_ENABLED ? latest : DEMO_LATEST;

  const [scannedCount, blockedCount, sellerCount] = stats;
  const [mainSetup, ...otherSetups] = featured;

  // Fond animé du haut de page : miniatures des ressources en ligne (ou de la démo)
  // Mises en avant payées : tirage pondéré par la commission choisie, à chaque affichage
  const [heroImages, promoted] = await Promise.all([getShowcaseImages(), pickPromoted({ count: 8 })]);

  return (
    <div className="full-bleed">
      {/* Pour Google : nom et logo du site, et la recherche du catalogue */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }} />
      {/* 1. Recherche et catégories, devant les miniatures qui défilent */}
      <div className="relative isolate">
        {/* Miniatures : celles des exemples en mode démo (pas encore d'images pour les vraies ressources) */}
        <HeroBackdrop images={heroImages} />
        <section className="container-q pb-6 pt-14 text-center sm:pt-16">
          <h1 className="animate-fade-up text-3xl font-semibold tracking-tight sm:text-5xl">
            {t.home.titleStart} <span className="highlight">{t.home.titleHighlight}</span>
            {t.home.titleEnd && ` ${t.home.titleEnd}`}
          </h1>
          {/* Recherche minimaliste : un seul champ, on valide avec Entrée */}
          <form action="/resources" role="search" className="animate-fade-up mx-auto mt-8 max-w-lg" style={{ animationDelay: "120ms" }}>
            <label className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 transition focus-within:border-text focus-within:shadow-[0_8px_30px_-10px_rgba(0,0,0,0.2)]">
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
            <Users className="h-4 w-4" aria-hidden="true" />
            {t.home.communityNote(memberCount, activeSellers, formatAmount(earned._sum.amountCents ?? 0, locale))}
          </p>
        </section>

        {/* 2. Catégories : juste sous la recherche, visibles sans défiler */}
        <section className="container-q pb-3">
          {/* Petits rectangles discrets : icône + nom sur une ligne */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {CATEGORIES.map((c, i) => (
              <Link
                key={c.id}
                href={`/resources?category=${c.id}`}
                style={{ animationDelay: `${250 + i * 50}ms` }}
                className="animate-fade-up group flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-2 py-2.5 text-[13px] font-semibold text-muted transition duration-200 hover:border-accent hover:bg-accent-soft hover:text-text"
              >
                <CategoryIcon category={c.id} className="h-[18px] w-[18px] shrink-0 transition duration-300 group-hover:-rotate-12 group-hover:scale-110" />
                <span className="truncate">{c.label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Mis en avant : ressources sponsorisées (cachée s'il n'y en a aucune) */}
      {promoted.length > 0 && (
        <section className="reveal container-q mt-4">
          <SectionTitle title={t.promo.homeTitle} subtitle={t.promo.homeSub} href="/resources" seeAll={t.home.seeAll} />
          <Gallery>
            {promoted.map((r) => (
              <ResourceCard key={r.id} resource={r} locale={locale} sponsored />
            ))}
          </Gallery>
        </section>
      )}

      {/* 3. Les plus vendues en ce moment (cachée tant qu'il n'y a aucune vente) */}
      {bestSellers.length > 0 && (
        <section className="reveal container-q mt-4">
          <SectionTitle title={t.home.bestSellers} subtitle={t.home.bestSellersSub} href="/resources" seeAll={t.home.seeAll} />
          <Gallery>
            {bestSellers.map(({ resource, sales }, i) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                locale={locale}
                rank={i + 1}
                sales={sales}
              />
            ))}
          </Gallery>
        </section>
      )}

      {/* 4. Les plus récentes (cachée tant qu'il n'y a aucune ressource) */}
      {latestResources.length > 0 && (
        <section className="reveal container-q mt-4">
          <SectionTitle title={t.home.latest} subtitle={t.home.latestSub} href="/resources" seeAll={t.home.seeAll} />
          <Gallery>
            {latestResources.map((r) => (
              <ResourceCard key={r.id} resource={r} locale={locale} />
            ))}
          </Gallery>
        </section>
      )}

      {/* 5. Game Setups à la une (caché s'il n'y en a aucun) */}
      {mainSetup && (
        <section className="reveal mt-12 bg-surface py-12">
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
      <section className="mt-12 bg-surface py-12">
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

      {/* 9. Devenir vendeur */}
      <SellerBlock t={t} />
    </div>
  );
}

// Encart pour recruter des vendeurs, en bas de l'accueil
function SellerBlock({ t }: { t: Awaited<ReturnType<typeof getDictionary>>["t"] }) {
  return (
    <section className="reveal container-q mt-16">
      <div className="flex flex-col gap-6 rounded-3xl bg-text p-8 text-bg sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="flex gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-text">
            <Store className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{t.home.sellerBlockTitle}</h2>
            <p className="mt-1 text-bg/70">{t.home.sellerBlockText}</p>
          </div>
        </div>
        <Link href="/become-seller" className="group inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-xl bg-accent px-6 text-[15px] font-semibold text-text transition hover:-translate-y-px hover:bg-accent-hover sm:self-center">
          {t.home.sellerBlockCta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle, href, seeAll }: { title: string; subtitle?: string; href?: string; seeAll?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
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
