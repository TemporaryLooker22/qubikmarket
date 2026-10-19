import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, ChevronRight, Clock, Download, Languages, Lock, MessageCircle, ShieldCheck, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { categoryLabel } from "@/lib/catalog";
import { DEMO_RESOURCES, findDemo } from "@/lib/demo";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatDate, formatPrice, formatSize } from "@/lib/i18n/format";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { isDemoMode } from "@/lib/payments";
import { translate } from "@/lib/translate";
import type { ScanReport } from "@/lib/scan";
import { buyResource } from "@/app/actions";
import { buyerFeeCents } from "@/lib/buyer-fee";
import { ResourceCard } from "@/components/ResourceCard";
import { Markdown } from "@/components/Markdown";
import { ScanReportView } from "@/components/ScanReportView";
import { StatusBadge } from "@/components/StatusBadge";
import { Stars } from "@/components/Stars";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReviewItem, type ReviewData } from "@/components/reviews/ReviewItem";
import { canReview, REVIEWS_SHOWN, sellerRating, VISIBLE_REVIEW } from "@/lib/reviews";
import { ShareButton } from "@/components/product/ShareButton";
import { responseTime } from "@/lib/chat";
import { memberRating } from "@/lib/member-reviews";
import { pickPromoted } from "@/lib/promotion";
import { SITE_URL } from "@/lib/site";
import { links } from "@/lib/notifications";
import { UserAvatar } from "@/components/UserAvatar";
import type { ResponseBucket } from "@/lib/chat-text";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ bought?: string; original?: string; avis?: string }>;

// Tout ce que la page affiche, que la ressource soit réelle ou un exemple de démo
type Product = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  priceCents: number;
  images: string[];
  videoId?: string | null; // vidéo de présentation YouTube
  fileName: string;
  fileSize: number;
  createdAt: Date;
  sales: number;
  scanVerdict: string;
  scriptCount: number;
  status: string;
  reviewNote: string | null;
  // Versions publiées (en ligne et anciennes), la plus récente d'abord
  version?: string;
  versionUpdatedAt?: Date | null;
  versions?: { version: string; notes: string | null; createdAt: Date }[];
  // Badge « Contenu vérifié » : l'analyse IA confirme que le contenu correspond à la description
  aiVerified?: boolean;
  // Avis des acheteurs (absents pour les exemples de démo)
  rating?: { avg: number; count: number; dist: number[] }; // dist : nombre d'avis à 5, 4, 3, 2 et 1 étoile(s)
  // rating = null : pas encore d'avis sur les ressources du vendeur
  seller: { username: string; resources: number; sales: number; rating: number | null; reviews: number; avatarUrl?: string | null; profile?: boolean; member?: { rating: number | null; count: number } };
};

// Avis affichés sous la ressource, et ce que le visiteur peut en faire
type Reviews = {
  list: ReviewData[];
  mine: { rating: number; body: string | null } | null;
  canReview: "yes" | "download" | "no";
  isSeller: boolean;
  isAdmin: boolean;
  showAll: boolean;
  viewerId?: string;
};

// Ce que le visiteur peut faire sur cette ressource
// contact : bouton « Contacter le vendeur » (absent sur ses propres ressources et les exemples de démo)
type Access = { demo: boolean; canDownload: boolean; canBuy: boolean; loggedIn: boolean; bought: boolean; contact?: { href: string; response: ResponseBucket | null } | null };

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const demo = findDemo(slug);
  if (demo) return { title: demo.title, description: demo.summary };
  const resource = await db.resource.findUnique({ where: { slug }, select: { title: true, summary: true, status: true, images: true } });
  if (resource?.status !== "APPROVED") return {};
  const images = resource.images.slice(0, 1);
  return {
    title: resource.title,
    description: resource.summary,
    alternates: { canonical: `/resources/${slug}` },
    openGraph: { type: "website", title: resource.title, description: resource.summary, url: `/resources/${slug}`, images },
    twitter: { card: images.length ? "summary_large_image" : "summary", title: resource.title, description: resource.summary, images },
  };
}

export default async function ResourcePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug }, { bought, original, avis }, user, { locale, t }] = await Promise.all([params, searchParams, getCurrentUser(), getDictionary()]);

  let product: Product;
  let access: Access;
  let report: ScanReport | null = null; // détail du scan : seulement pour le vendeur et les modérateurs
  let similar: (React.ComponentProps<typeof ResourceCard>["resource"] & { id: string })[];
  let sponsoredIds = new Set<string>();
  let reviews: Reviews | null = null;

  const demo = findDemo(slug);
  if (demo) {
    // Exemple de démo (aperçu seulement)
    product = { ...demo, scanVerdict: "clean", status: "APPROVED", reviewNote: null };
    access = { demo: true, canDownload: false, canBuy: false, loggedIn: Boolean(user), bought: false };
    similar = DEMO_RESOURCES.filter((r) => r.id !== demo.id && r.category === demo.category).concat(DEMO_RESOURCES.filter((r) => r.category !== demo.category)).slice(0, 4);
  } else {
    const resource = await db.resource.findUnique({
      where: { slug },
      include: {
        seller: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { purchases: { where: { status: "PAID" } } } },
        versions: { where: { status: { in: ["LIVE", "OLD"] } }, orderBy: { createdAt: "desc" }, select: { version: true, notes: true, createdAt: true } },
      },
    });
    if (!resource) notFound();

    const isOwner = user?.id === resource.sellerId;
    const isAdmin = user?.role === "ADMIN";
    const purchase = user ? await db.purchase.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId: resource.id } } }) : null;
    // Une ressource pas encore validée n'est visible que par son vendeur et les modérateurs ;
    // une ressource retirée de la vente reste visible pour ceux qui l'ont achetée
    const visible = resource.status === "APPROVED" || isOwner || isAdmin || (resource.status === "UNLISTED" && purchase?.status === "PAID");
    if (!visible) notFound();

    const [sellerResources, sellerSales, similarResources, reviewList, distribution, sellerStars, reviewStatus, sellerResponse, sellerMember] = await Promise.all([
      db.resource.count({ where: { sellerId: resource.sellerId, status: "APPROVED" } }),
      db.purchase.count({ where: { status: "PAID", resource: { sellerId: resource.sellerId } } }),
      db.resource.findMany({
        where: { status: "APPROVED", category: resource.category, id: { not: resource.id } },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { seller: { select: { username: true } } },
      }),
      // Avis : les plus récents d'abord
      db.review.findMany({ where: { resourceId: resource.id, ...VISIBLE_REVIEW }, orderBy: { createdAt: "desc" }, include: { user: { select: { username: true, avatarUrl: true } } } }),
      db.review.groupBy({ by: ["rating"], where: { resourceId: resource.id, ...VISIBLE_REVIEW }, _count: true }),
      sellerRating(resource.sellerId),
      user && !isOwner ? canReview(user.id, resource.id) : Promise.resolve("no" as const),
      // Temps de réponse habituel du vendeur dans la messagerie
      isOwner ? Promise.resolve(null) : responseTime(resource.sellerId),
      // Avis laissés sur le vendeur lui-même (profil)
      memberRating(resource.sellerId, "SELLER"),
    ]);

    const mine = user ? reviewList.find((r) => r.userId === user.id) : undefined;
    reviews = {
      list: reviewList,
      mine: mine ? { rating: mine.rating, body: mine.body } : null,
      canReview: reviewStatus,
      isSeller: isOwner,
      isAdmin,
      showAll: avis === "all",
      viewerId: user?.id,
    };

    const scan = JSON.parse(resource.scanReport) as ScanReport;
    if (isOwner || isAdmin) report = scan;
    product = {
      ...resource,
      sales: resource._count.purchases,
      scriptCount: scan.scriptCount,
      rating: {
        avg: resource.ratingAvg,
        count: resource.ratingCount,
        dist: [5, 4, 3, 2, 1].map((n) => distribution.find((d) => d.rating === n)?._count ?? 0),
      },
      seller: {
        username: resource.seller.username,
        resources: sellerResources,
        sales: sellerSales,
        rating: sellerStars.rating,
        reviews: sellerStars.reviews,
        avatarUrl: resource.seller.avatarUrl,
        profile: true,
        member: sellerMember,
      },
    };
    access = {
      demo: false,
      canDownload: isOwner || isAdmin || purchase?.status === "PAID",
      canBuy: resource.status === "APPROVED" && !isOwner,
      loggedIn: Boolean(user),
      bought: Boolean(bought),
      contact: isOwner ? null : { href: `/messages/new?to=${encodeURIComponent(resource.seller.username)}&r=${resource.id}`, response: sellerResponse },
    };
    // Jusqu'à 2 ressources sponsorisées de la même catégorie, en premier
    const promotedSimilar = await pickPromoted({ count: 2, category: resource.category, excludeIds: [resource.id] });
    sponsoredIds = new Set(promotedSimilar.map((r) => r.id));
    similar = [...promotedSimilar, ...similarResources.filter((r) => !sponsoredIds.has(r.id))].slice(0, 4);
  }

  const label = categoryLabel(product.category);

  // En français : résumé et description traduits automatiquement (sauf si on demande l'original)
  let translation: "none" | "translated" | "original" = "none";
  if (locale === "fr") {
    if (original) {
      translation = "original";
    } else {
      const [summary, description] = await Promise.all([translate(product.summary, locale), translate(product.description, locale)]);
      if (summary.translated || description.translated) {
        product = { ...product, summary: summary.text, description: description.text };
        translation = "translated";
      }
    }
  }

  // Données produit pour Google (prix, disponibilité, note) : peuvent afficher les étoiles dans les résultats
  const jsonLd =
    !access.demo && product.status === "APPROVED"
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          description: product.summary,
          image: product.images.slice(0, 3),
          category: label,
          url: `${SITE_URL}/resources/${product.slug}`,
          brand: { "@type": "Brand", name: product.seller.username },
          offers: {
            "@type": "Offer",
            price: (product.priceCents / 100).toFixed(2),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url: `${SITE_URL}/resources/${product.slug}`,
          },
          ...(product.rating && product.rating.count > 0 && {
            aggregateRating: { "@type": "AggregateRating", ratingValue: product.rating.avg.toFixed(1), reviewCount: product.rating.count, bestRating: 5, worstRating: 1 },
          }),
        }
      : null;

  return (
    <div className="full-bleed container-q pb-28 pt-6 lg:pb-0">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      {/* Le vrai titre de la page (lu par Google et les lecteurs d'écran) ; le titre visible est dans l'encart */}
      <h1 className="sr-only">{product.title}</h1>

      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-1.5 text-sm text-muted" aria-label="Breadcrumb">
        <Link href="/resources" className="hover:text-text">
          {t.catalog.title}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href={`/resources?category=${product.category}`} className="hover:text-text">
          {label}
        </Link>
      </nav>

      {/* Pour le vendeur et les modérateurs : statut et note de modération */}
      {product.status !== "APPROVED" && (
        <div className="mt-3">
          <StatusBadge status={product.status} />
        </div>
      )}
      {product.reviewNote && report && (
        <div className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <strong>{t.resource.reviewNote} : </strong>
          {product.reviewNote}
        </div>
      )}

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <div className="animate-fade-up">
            <ProductGallery images={product.images} category={product.category} title={product.title} videoId={product.videoId} />
          </div>

          {/* Titre, prix… sur mobile et tablette (sur ordinateur : dans l'encart à droite) */}
          <div className="lg:hidden">
            <BuyBox product={product} access={access} locale={locale} t={t} showAction={false} />
          </div>

          <Card title={t.resource.description}>
            {translation !== "none" && (
              <p className="-mt-1 mb-3 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                {translation === "translated" && <span>{t.resource.translated} ·</span>}
                <Link
                  href={translation === "translated" ? `/resources/${product.slug}?original=1` : `/resources/${product.slug}`}
                  scroll={false}
                  className="font-medium text-text underline decoration-accent decoration-2 underline-offset-2"
                >
                  {translation === "translated" ? t.resource.showOriginal : t.resource.showTranslation}
                </Link>
              </p>
            )}
            <Markdown>{product.description}</Markdown>
          </Card>

          {/* Sécurité : un résumé pour tous, le détail seulement pour le vendeur et les modérateurs */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold">{product.scanVerdict === "clean" ? t.resource.securityClean : t.resource.securityReviewed}</h2>
                <p className="mt-1 text-sm text-muted">{t.resource.securityText(product.scriptCount)}</p>
                {product.aiVerified && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-0.5 text-xs font-bold text-ok">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.ai.verified}
                  </span>
                )}
              </div>
            </div>
            {report && (
              <details className="mt-4 border-t border-border pt-4 text-sm">
                <summary className="cursor-pointer font-medium">{t.resource.securityDetails}</summary>
                <div className="mt-2">
                  <ScanReportView report={report} />
                </div>
              </details>
            )}
          </section>

          {/* Historique des versions (dès la première mise à jour) */}
          {product.versions && product.versions.length > 1 && (
            <Card title={t.resource.versionsTitle}>
              <ul className="divide-y divide-border">
                {product.versions.map((v, i) => (
                  <li key={v.version} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="w-14 shrink-0 font-extrabold">v{v.version}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        {formatDate(v.createdAt, locale)}
                        {i === 0 && <span className="ml-2 rounded-full bg-ok-bg px-2 py-px text-[11px] font-semibold text-ok">{t.resource.versionCurrent}</span>}
                      </p>
                      {v.notes && <p className="mt-1 whitespace-pre-line text-sm">{v.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <Card title={t.resource.details}>
              <dl className="space-y-2 text-sm">
                {product.version && <Detail label={t.resource.versionsTitle} value={`v${product.version}`} />}
                {product.versionUpdatedAt && <Detail label={t.resource.updated} value={formatDate(product.versionUpdatedAt, locale)} />}
                <Detail label={t.resource.format} value={product.fileName.split(".").pop()?.toUpperCase() ?? "—"} />
                <Detail label={t.resource.size} value={formatSize(product.fileSize, locale)} />
                <Detail label={t.resource.published} value={formatDate(product.createdAt, locale)} />
                <Detail label={t.resource.downloads} value={String(product.sales)} />
              </dl>
            </Card>
            <Card title={t.resource.seller}>
              <div className="flex items-center gap-3">
                <UserAvatar name={product.seller.username} src={product.seller.avatarUrl} size={44} />
                <div className="min-w-0">
                  {product.seller.profile ? (
                    <Link href={links.profile(product.seller.username)} className="block truncate font-semibold hover:underline">
                      {product.seller.username}
                    </Link>
                  ) : (
                    <p className="truncate font-semibold">{product.seller.username}</p>
                  )}
                  <p className="text-sm text-muted">{t.resource.sellerStats(product.seller.resources, product.seller.sales)}</p>
                </div>
              </div>
              {/* Note du vendeur : avis laissés sur lui (profil), sinon la moyenne des avis de ses ressources */}
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                {product.seller.member?.rating != null ? (
                  <>
                    <span className="text-2xl font-bold tracking-tight">{formatRating(product.seller.member.rating, locale)}</span>
                    <div>
                      <Stars rating={product.seller.member.rating} label={t.resource.rating(formatRating(product.seller.member.rating, locale))} />
                      <p className="text-xs text-muted">{t.profile.statSeller(product.seller.member.count)}</p>
                    </div>
                  </>
                ) : product.seller.rating !== null ? (
                  <>
                    <span className="text-2xl font-bold tracking-tight">{formatRating(product.seller.rating, locale)}</span>
                    <div>
                      <Stars rating={product.seller.rating} label={t.resource.rating(formatRating(product.seller.rating, locale))} />
                      <p className="text-xs text-muted">{t.resource.reviews(product.seller.reviews)}</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Stars rating={0} label={t.resource.noReviews} />
                    <span className="text-sm text-muted">{t.resource.noReviews}</span>
                  </>
                )}
                {product.seller.profile && (
                  <Link href={links.profile(product.seller.username)} className="btn-ghost ml-auto px-3 py-1.5 text-xs">
                    {t.profile.viewProfile} →
                  </Link>
                )}
              </div>
            </Card>
          </div>

          {/* Avis des acheteurs */}
          {reviews && product.rating && <ReviewsSection product={product} reviews={reviews} locale={locale} t={t} />}
        </div>

        {/* Encart d'achat (ordinateur) : reste visible en défilant */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <BuyBox product={product} access={access} locale={locale} t={t} />
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="reveal mt-14">
          <h2 className="mb-4 text-xl font-semibold tracking-tight sm:text-2xl">{t.resource.similar}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((r) => (
              <ResourceCard key={r.slug} resource={r} locale={locale} sponsored={sponsoredIds.has(r.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Barre d'achat collée en bas de l'écran (mobile et tablette) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <span>
            <span className="block text-xl font-bold">{formatPrice(product.priceCents, locale)}</span>
            {showFee(product, access) && <span className="block text-xs text-muted">{t.resource.serviceFeeShort(formatAmount(buyerFeeCents(product.priceCents), locale))}</span>}
          </span>
          <div className="w-48">
            <BuyAction product={product} access={access} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Encart : catégorie, titre, vendeur, prix, bouton d'achat, partage, garanties
function BuyBox({ product, access, locale, t, showAction = true }: { product: Product; access: Access; locale: Locale; t: Dictionary; showAction?: boolean }) {
  return (
    <div className="animate-fade-up rounded-2xl border border-border bg-card p-5 sm:p-6" style={{ animationDelay: "80ms" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{categoryLabel(product.category)}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight" aria-hidden="true">
        {product.title}
      </p>
      <p className="mt-1.5 text-sm text-muted">
        {product.seller.profile ? (
          <>
            {t.resource.by("")}
            <Link href={links.profile(product.seller.username)} className="font-semibold text-text underline-offset-2 hover:underline">
              {product.seller.username}
            </Link>
          </>
        ) : (
          t.resource.by(product.seller.username)
        )}{" "}
        · {t.card.sales(product.sales)}
      </p>
      {/* Note des acheteurs : mène aux avis plus bas */}
      {product.rating && product.rating.count > 0 && (
        <a href="#avis" className="mt-1.5 inline-flex items-center gap-1.5 text-sm">
          <Stars rating={product.rating.avg} label={t.resource.rating(formatRating(product.rating.avg, locale))} className="h-3.5 w-3.5" />
          <span className="font-semibold">{formatRating(product.rating.avg, locale)}</span>
          <span className="text-muted underline underline-offset-2">{t.resource.reviews(product.rating.count)}</span>
        </a>
      )}
      <p className="mt-3 text-[15px] leading-relaxed text-text/80">{product.summary}</p>

      <p className="mt-5 text-3xl font-bold tracking-tight">{formatPrice(product.priceCents, locale)}</p>
      {/* Frais de service de l'acheteur (affichés avant l'achat, avec le total) */}
      {showFee(product, access) && (
        <p className="mt-1 text-sm text-muted" title={t.resource.serviceFeeHelp}>
          {t.resource.serviceFee(formatAmount(buyerFeeCents(product.priceCents), locale), formatAmount(product.priceCents + buyerFeeCents(product.priceCents), locale))}
        </p>
      )}

      {access.bought && <p className="mt-3 rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok">{t.resource.bought}</p>}

      {showAction && (
        <div className="mt-4">
          <BuyAction product={product} access={access} t={t} />
        </div>
      )}
      {!access.loggedIn && access.canBuy && product.priceCents > 0 && <p className="mt-2 text-xs text-muted">{t.resource.loginToBuy}</p>}
      {isDemoMode && access.canBuy && !access.canDownload && product.priceCents > 0 && <p className="mt-2 text-xs text-warn">{t.resource.demo}</p>}

      {access.contact && (
        <>
          <Link
            href={access.contact.href}
            prefetch={false}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong text-sm font-semibold transition hover:bg-bg"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t.chat.contact}
          </Link>
          {access.contact.response && (
            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-muted">
              <Clock className="h-3 w-3" aria-hidden="true" /> {t.chat.response[access.contact.response]}
            </p>
          )}
        </>
      )}

      <ShareButton className="mt-2 w-full" />

      <ul className="mt-5 space-y-2 border-t border-border pt-4 text-sm text-muted">
        <li className="flex items-center gap-2.5">
          <Zap className="h-4 w-4 text-text" aria-hidden="true" /> {t.resource.guarantees.instant}
        </li>
        <li className="flex items-center gap-2.5">
          <Lock className="h-4 w-4 text-text" aria-hidden="true" /> {t.resource.guarantees.secure}
        </li>
        <li className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-text" aria-hidden="true" /> {t.resource.guarantees.verified}
        </li>
        {product.aiVerified && (
          <li className="flex items-center gap-2.5">
            <BadgeCheck className="h-4 w-4 text-ok" aria-hidden="true" /> {t.ai.verified}
          </li>
        )}
      </ul>
    </div>
  );
}

// Les frais de service s'affichent tant que la ressource payante peut être achetée
const showFee = (product: Product, access: Access) => !isDemoMode && product.priceCents > 0 && access.canBuy && !access.canDownload && !access.demo;

// Le bouton principal : Télécharger (déjà acheté), Acheter / Obtenir, ou rien (démo, ressource à soi en attente…)
function BuyAction({ product, access, t }: { product: Product; access: Access; t: Dictionary }) {
  const base = "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition";
  if (access.demo) {
    return <span className={`${base} cursor-not-allowed bg-surface text-muted`}>{t.resource.demoBuy}</span>;
  }
  if (access.canDownload) {
    return (
      <a href={`/api/download/${product.id}`} className={`${base} bg-text text-bg hover:bg-text/85`}>
        <Download className="h-4 w-4" aria-hidden="true" /> {t.resource.download}
      </a>
    );
  }
  if (!access.canBuy) return null;
  return (
    <form action={buyResource}>
      <input type="hidden" name="resourceId" value={product.id} />
      <button className={`${base} bg-accent text-text hover:-translate-y-px hover:bg-accent-hover`}>
        {product.priceCents === 0 ? t.resource.getFree : t.resource.buy}
      </button>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// 4,8 en français, 4.8 en anglais
// Avis : note moyenne et répartition, formulaire (acheteur qui a téléchargé), liste des avis
function ReviewsSection({ product, reviews, locale, t }: { product: Product; reviews: Reviews; locale: Locale; t: Dictionary }) {
  const { avg, count, dist } = product.rating!;
  const shown = reviews.showAll ? reviews.list : reviews.list.slice(0, REVIEWS_SHOWN);
  const hidden = reviews.list.length - shown.length;
  return (
    <section id="avis" className="scroll-mt-24 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">{t.reviews.title}</h2>

      {count > 0 ? (
        <div className="mt-4 grid items-center gap-6 border-b border-border pb-5 sm:grid-cols-[150px_minmax(0,1fr)]">
          <div>
            <p className="text-5xl font-extrabold leading-none tracking-tight">{formatRating(avg, locale)}</p>
            <Stars rating={avg} label={t.resource.rating(formatRating(avg, locale))} className="mt-2 h-4 w-4" />
            <p className="mt-1 text-xs text-muted">{t.reviews.fromBuyers(count)}</p>
          </div>
          <div className="space-y-1.5">
            {dist.map((n, i) => (
              <div key={i} className="grid grid-cols-[14px_minmax(0,1fr)_28px] items-center gap-2 text-xs text-muted">
                <span>{5 - i}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-surface">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / count) * 100}%` }} />
                </span>
                <span className="text-right">{n}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted">
          {t.resource.noReviews}. {t.reviews.noneText}
        </p>
      )}

      {reviews.canReview === "yes" && (
        <div className="mt-5">
          <ReviewForm resourceId={product.id} initial={reviews.mine} />
        </div>
      )}
      {reviews.canReview === "download" && <p className="mt-5 rounded-xl bg-bg px-4 py-3 text-sm">{t.reviews.downloadFirst}</p>}

      {shown.length > 0 && (
        <ul className="mt-5 divide-y divide-border">
          {shown.map((r) => (
            <ReviewItem key={r.id} review={r} sellerName={product.seller.username} canReply={reviews.isSeller} canDelete={reviews.isAdmin} viewerId={reviews.viewerId} locale={locale} t={t} />
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <Link href={`/resources/${product.slug}?avis=all#avis`} scroll={false} className="btn-ghost mt-4">
          {t.reviews.showAll(hidden)}
        </Link>
      )}
    </section>
  );
}

function formatRating(rating: number, locale: Locale) {
  return rating.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
