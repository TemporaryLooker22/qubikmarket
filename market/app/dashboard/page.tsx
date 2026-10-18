import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck, Download, ShieldAlert, ShieldX, ShoppingCart, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatDate, formatNumber } from "@/lib/i18n/format";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SalesChart, type ChartDay } from "@/components/dashboard/SalesChart";
import { Thumb } from "@/components/dashboard/Thumb";
import { ReviewItem } from "@/components/reviews/ReviewItem";
import { Stars } from "@/components/Stars";
import { sellerRating } from "@/lib/reviews";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.dashboard.title };
}

const DAY = 24 * 60 * 60 * 1000;
const dayKey = (date: Date) => date.toISOString().slice(0, 10); // AAAA-MM-JJ (heure UTC)

// Vue d'ensemble du vendeur : à faire, chiffres des 30 derniers jours, graphique, ventes récentes, meilleures ressources
export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ published?: string }> }) {
  const user = await requireUser("/dashboard");
  const [{ published }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);

  // Les 30 derniers jours (aujourd'hui compris, à partir de minuit), et les 30 jours d'avant pour comparer
  const now = Date.now();
  const since30 = new Date(`${dayKey(new Date(now - 29 * DAY))}T00:00:00Z`);
  const since60 = new Date(since30.getTime() - 30 * DAY);

  const [resources, recentPurchases, recentSales, latestReviews, rating] = await Promise.all([
    db.resource.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        status: true,
        images: true,
        updatedAt: true,
        purchases: { where: { status: "PAID" }, select: { amountCents: true, earning: { select: { amountCents: true } } } },
      },
    }),
    // Gains des ventes des 60 derniers jours (30 jours affichés + 30 jours pour comparer), hors ventes remboursées
    db.sellerEarning.findMany({
      where: { sellerId: user.id, purchaseId: { not: null }, status: { not: "CANCELED" }, createdAt: { gte: since60 } },
      select: { amountCents: true, createdAt: true },
    }),
    db.sellerEarning.findMany({
      where: { sellerId: user.id, purchaseId: { not: null }, status: { not: "CANCELED" } },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        amountCents: true,
        createdAt: true,
        purchase: { select: { user: { select: { username: true } }, resource: { select: { title: true, slug: true } } } },
      },
    }),
    // Derniers avis sur ses ressources (le vendeur peut y répondre)
    db.review.findMany({
      where: { resource: { sellerId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { username: true } }, resource: { select: { title: true, slug: true } } },
    }),
    sellerRating(user.id),
  ]);

  // Pas encore vendeur : « Mon espace » montre directement ses achats
  if (resources.length === 0) redirect("/dashboard/purchases");

  // Chiffres des 30 derniers jours, comparés aux 30 jours d'avant
  const paid = recentPurchases;
  const inLast30 = (p: { createdAt: Date }) => p.createdAt >= since30;
  const net = (list: typeof paid) => list.reduce((n, e) => n + e.amountCents, 0);
  const current = { net: net(paid.filter(inLast30)), sales: paid.filter(inLast30).length };
  const previous = { net: net(paid.filter((p) => !inLast30(p))), sales: paid.filter((p) => !inLast30(p)).length };
  const freeDownloads = resources.flatMap((r) => r.purchases).filter((p) => p.amountCents === 0).length;
  const live = resources.filter((r) => r.status === "APPROVED").length;

  // Une barre par jour, aujourd'hui compris
  const days: ChartDay[] = Array.from({ length: 30 }, (_, i) => ({ date: dayKey(new Date(now - (29 - i) * DAY)), sales: 0, netCents: 0 }));
  const byDate = new Map(days.map((d) => [d.date, d]));
  for (const p of paid) {
    const day = byDate.get(dayKey(p.createdAt));
    if (day) {
      day.sales++;
      day.netCents += p.amountCents;
    }
  }

  // À faire : ressources en attente de modération, et celles refusées ces 30 derniers jours
  const todo = resources.filter((r) => r.status === "PENDING" || (r.status === "REJECTED" && r.updatedAt >= since30)).slice(0, 3);

  // Meilleures ressources : celles qui ont rapporté le plus (ventes payantes seulement)
  const top = resources
    .map((r) => {
      const sold = r.purchases.filter((p) => p.earning);
      return { ...r, sales: sold.length, net: sold.reduce((n, p) => n + (p.earning?.amountCents ?? 0), 0) };
    })
    .filter((r) => r.sales > 0)
    .sort((a, b) => b.net - a.net || b.sales - a.sales)
    .slice(0, 4);

  const message = published ? t.dashboard.published[published] : null;
  const messageStyle = { analyzing: "bg-accent-soft text-text", approved: "bg-ok-bg text-ok", pending: "bg-warn-bg text-warn", rejected: "bg-bad-bg text-bad" }[published ?? ""] ?? "bg-surface";

  return (
    <>
      <DashboardHeader title={t.dashboard.hello(user.username)} intro={t.dashboard.overviewIntro} newResource={t.dashboard.newResource} />

      {message && (
        <p role="status" className={`animate-pop mb-4 rounded-xl px-4 py-3 text-sm font-medium ${messageStyle}`}>
          {message}
          {published === "analyzing" && (
            <Link href="/dashboard/resources" className="ml-1.5 font-bold underline underline-offset-2">
              {t.dashboard.menu.resources} →
            </Link>
          )}
        </p>
      )}

      {todo.length > 0 && (
        <div className="mb-4 space-y-2">
          {todo.map((r) => {
            const pending = r.status === "PENDING";
            const Icon = pending ? ShieldAlert : ShieldX;
            return (
              <div key={r.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${pending ? "bg-warn-bg text-warn" : "bg-bad-bg text-bad"}`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="min-w-0 flex-1">
                  <strong>{r.title}</strong> {pending ? t.dashboard.todoPending : t.dashboard.todoRejected}
                </p>
                <Link href={`/dashboard/resources?report=${r.id}#${r.id}`} className="shrink-0 font-bold underline-offset-2 hover:underline">
                  {pending ? t.dashboard.todoView : t.dashboard.todoReport}
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat dark icon={Wallet} label={t.dashboard.statRevenue} value={formatAmount(current.net, locale)} delta={delta(current.net, previous.net, locale)} note={t.dashboard.vsPrevious} />
        <Stat icon={ShoppingCart} label={t.dashboard.statSales} value={formatNumber(current.sales, locale)} delta={delta(current.sales, previous.sales, locale)} note={t.dashboard.vsPrevious} />
        <Stat icon={Download} label={t.dashboard.statDownloads} value={formatNumber(freeDownloads, locale)} note={t.dashboard.allTime} />
        <Stat icon={CircleCheck} label={t.dashboard.statLive} value={formatNumber(live, locale)} note={t.dashboard.liveOf(resources.length)} />
      </div>

      <SalesChart days={days} />

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t.dashboard.recentSales}</h2>
            {recentSales.length > 0 && (
              <Link href="/dashboard/sales" className="text-sm font-semibold text-muted hover:text-text">
                {t.dashboard.seeAll}
              </Link>
            )}
          </div>
          {recentSales.length === 0 ? (
            <p className="py-4 text-sm text-muted">{t.dashboard.noSalesYet}</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentSales.map(({ id, amountCents, createdAt, purchase }) =>
                purchase ? (
                  <li key={id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/resources/${purchase.resource.slug}`} className="block truncate text-sm font-semibold hover:underline">
                        {purchase.resource.title}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {purchase.user.username} · {formatDate(createdAt, locale)}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-bold">+{formatAmount(amountCents, locale)}</span>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold">{t.dashboard.topResources}</h2>
            <Link href="/dashboard/resources" className="text-sm font-semibold text-muted hover:text-text">
              {t.dashboard.seeAll}
            </Link>
          </div>
          {top.length === 0 ? (
            <p className="py-4 text-sm text-muted">{t.dashboard.noSalesYet}</p>
          ) : (
            <ul className="divide-y divide-border">
              {top.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <Thumb image={r.images[0]} category={r.category} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/resources/${r.slug}`} className="block truncate text-sm font-semibold hover:underline">
                      {r.title}
                    </Link>
                    <p className="text-xs text-muted">{t.card.sales(r.sales)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold">{formatAmount(r.net, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Derniers avis des acheteurs, avec un champ pour répondre */}
      <section className="mt-4 rounded-2xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{t.reviews.latest}</h2>
          {rating.rating !== null && (
            <span className="flex items-center gap-1.5 text-sm">
              <Stars rating={rating.rating} label={t.resource.rating(rating.rating.toFixed(1))} className="h-3.5 w-3.5" />
              <strong>{rating.rating.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
              <span className="text-muted">{t.reviews.average(rating.reviews)}</span>
            </span>
          )}
        </div>
        {latestReviews.length === 0 ? (
          <p className="py-2 text-sm text-muted">{t.reviews.noneSeller}</p>
        ) : (
          <ul className="divide-y divide-border">
            {latestReviews.map((r) => (
              <ReviewItem key={r.id} review={r} sellerName={user.username} canReply locale={locale} t={t} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// Évolution en % par rapport à la période précédente (rien s'il n'y avait aucune vente avant)
function delta(now: number, before: number, locale: string) {
  if (before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return { up: pct >= 0, text: `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}${locale === "fr" ? " %" : "%"}` };
}

function Stat({
  icon: Icon,
  label,
  value,
  delta,
  note,
  dark,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: { up: boolean; text: string } | null;
  note: string;
  dark?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${dark ? "border-text bg-text text-bg" : "border-border bg-card"}`}>
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${dark ? "text-bg/65" : "text-muted"}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 truncate text-2xl font-extrabold tracking-tight">{value}</p>
      <p className={`mt-0.5 truncate text-xs ${dark ? "text-bg/65" : "text-muted"}`}>
        {delta && <strong className={delta.up ? (dark ? "text-accent" : "text-ok") : dark ? "text-bg" : "text-bad"}>{delta.text} </strong>}
        {note}
      </p>
    </div>
  );
}

