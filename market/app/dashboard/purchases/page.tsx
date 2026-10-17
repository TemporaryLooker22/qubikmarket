import Link from "next/link";
import { ArrowRight, Download, ExternalLink, ShoppingBag, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate, formatPrice } from "@/lib/i18n/format";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Thumb } from "@/components/dashboard/Thumb";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.dashboard.menu.purchases };
}

// Mes achats : tout ce que le membre a acheté ou téléchargé, avec le bouton de téléchargement.
// C'est aussi la page d'accueil de « Mon espace » pour ceux qui n'ont encore rien publié.
export default async function DashboardPurchasesPage() {
  const user = await requireUser("/dashboard/purchases");
  const { locale, t } = await getDictionary();

  const [purchases, isSeller] = await Promise.all([
    db.purchase.findMany({
      where: { userId: user.id, status: "PAID" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountCents: true,
        createdAt: true,
        resource: { select: { id: true, slug: true, title: true, category: true, images: true, status: true, seller: { select: { username: true } } } },
      },
    }),
    db.resource.count({ where: { sellerId: user.id } }).then((n) => n > 0),
  ]);

  return (
    <>
      <DashboardHeader
        title={isSeller ? t.dashboard.menu.purchases : t.dashboard.title}
        intro={isSeller ? t.dashboard.purchasesIntro : t.dashboard.purchasesIntroBuyer(user.username)}
      />

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface">
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="mt-3 font-semibold">{t.dashboard.noPurchases}</p>
          <Link href="/resources" className="btn mt-4">
            {t.dashboard.explore}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {purchases.map(({ id, amountCents, createdAt, resource: r }) => (
            <li key={id} className="flex flex-col rounded-2xl border border-border bg-card p-2">
              <Thumb image={r.images[0]} category={r.category} className="w-full rounded-xl" />
              <div className="flex flex-1 flex-col px-1.5 pb-1.5 pt-3">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {t.card.by(r.seller.username)} · {formatPrice(amountCents, locale)} · {formatDate(createdAt, locale)}
                </p>
                {r.status === "UNLISTED" && (
                  <span className="mt-2 self-start rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">{t.dashboard.unlisted}</span>
                )}
                <div className="mt-auto flex gap-1.5 pt-3">
                  <a href={`/api/download/${r.id}`} className="btn flex-1">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t.dashboard.download}
                  </a>
                  <Link href={`/resources/${r.slug}`} className="btn-ghost px-3" aria-label={t.dashboard.viewPage} title={t.dashboard.viewPage}>
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Pas encore vendeur : encart pour se lancer */}
      {!isSeller && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-text p-5 text-bg">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-text">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-56 flex-1">
            <p className="font-semibold">{t.dashboard.sellerCtaTitle}</p>
            <p className="mt-0.5 text-sm text-bg/65">{t.dashboard.sellerCtaText}</p>
          </div>
          <Link href="/sell" className="btn-accent rounded-xl px-4 py-2.5">
            {t.dashboard.sellerCtaButton}
          </Link>
        </div>
      )}
    </>
  );
}
