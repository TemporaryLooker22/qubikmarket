import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, CheckCircle2, Crown, ExternalLink, Hourglass, Landmark, Receipt, Star, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { links } from "@/lib/notifications";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatDate } from "@/lib/i18n/format";
import { HOLD_DAYS } from "@/lib/earnings";
import { PAYOUT_COUNTRIES, refreshTransfersStatus } from "@/lib/connect";
import { MIN_PAYOUT_CENTS } from "@/lib/payouts";
import { isDemoMode } from "@/lib/payments";
import { PayoutSetupForm } from "@/components/dashboard/PayoutSetupForm";
import { FOUNDER_FEE_PERCENT } from "@/lib/sellers";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.dashboard.menu.sales };
}

const LIMIT = 100; // lignes affichées dans le tableau

// Ventes : soldes (en attente, disponible, déjà versé) et détail de chaque gain (registre SellerEarning)
export default async function DashboardSalesPage() {
  const user = await requireUser("/dashboard/sales");
  // Acheteurs déjà notés (avis sur le client, profil)
  const ratedBuyers = new Set(
    (await db.memberReview.findMany({ where: { authorId: user.id, role: "BUYER" }, select: { targetId: true } })).map((r) => r.targetId),
  );
  const { locale, t } = await getDictionary();

  const [resourceCount, seller, earnings, totals] = await Promise.all([
    db.resource.count({ where: { sellerId: user.id } }),
    db.user.findUnique({ where: { id: user.id }, select: { founderUntil: true, stripeAccountId: true, stripeTransfersActive: true } }),
    db.sellerEarning.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: {
        id: true,
        amountCents: true,
        grossCents: true,
        taxCents: true,
        feeCents: true,
        feePercent: true,
        status: true,
        availableAt: true,
        reversesId: true,
        createdAt: true,
        purchase: { select: { status: true, lastDownloadedAt: true, user: { select: { id: true, username: true } }, resource: { select: { title: true, slug: true } } } },
        reverses: { select: { purchase: { select: { resource: { select: { title: true, slug: true } } } } } },
      },
    }),
    // Soldes : on additionne tout le registre (pas seulement les lignes affichées)
    db.sellerEarning.groupBy({
      by: ["status"],
      where: { sellerId: user.id, status: "PAID" },
      _sum: { amountCents: true },
    }),
  ]);
  if (resourceCount === 0) redirect("/dashboard/purchases");

  const now = new Date();

  // Compte de versement : inscription Stripe pas terminée → on redemande l'état à Stripe (retour du formulaire, etc.)
  let transfersActive = seller?.stripeTransfersActive ?? false;
  if (seller?.stripeAccountId && !transfersActive && !isDemoMode) {
    transfersActive = await refreshTransfersStatus(user.id, seller.stripeAccountId)
      .then((r) => r.active)
      .catch(() => false);
  }
  const payouts = await db.sellerPayout.findMany({ where: { sellerId: user.id }, orderBy: { createdAt: "desc" }, take: 10 });
  // Pays proposés, avec leur nom dans la langue du visiteur
  const regionName = new Intl.DisplayNames([locale === "fr" ? "fr-FR" : "en-GB"], { type: "region" });
  const countries = PAYOUT_COUNTRIES.map((code) => ({ code, name: regionName.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, locale));
  const pendingRows = await db.sellerEarning.findMany({ where: { sellerId: user.id, status: "PENDING" }, select: { amountCents: true, availableAt: true } });
  const held = pendingRows.filter((e) => e.availableAt > now).reduce((n, e) => n + e.amountCents, 0);
  const available = pendingRows.filter((e) => e.availableAt <= now).reduce((n, e) => n + e.amountCents, 0);
  const paid = totals.find((g) => g.status === "PAID")?._sum.amountCents ?? 0;
  const isFounder = seller?.founderUntil && seller.founderUntil > now;

  const statusOf = (e: (typeof earnings)[number]) => {
    if (e.status === "CANCELED") return { label: t.dashboard.earningStatus.canceled, style: "bg-surface text-muted" };
    if (e.status === "PAID") return { label: t.dashboard.earningStatus.paid, style: "bg-ok-bg text-ok" };
    if (e.availableAt > now) return { label: t.dashboard.earningStatus.held(formatDate(e.availableAt, locale)), style: "bg-warn-bg text-warn" };
    return { label: t.dashboard.earningStatus.available, style: "bg-accent-soft text-text" };
  };

  return (
    <>
      <DashboardHeader title={t.dashboard.menu.sales} intro={t.dashboard.salesIntro} />

      {/* Recevoir mes gains : configuration du compte Stripe du vendeur */}
      {!isDemoMode && (
        <section className="mb-4 rounded-2xl border border-border bg-card p-5">
          {transfersActive ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ok-bg text-ok">
                <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-56 flex-1">
                <h2 className="font-semibold">{t.dashboard.payouts.activeTitle}</h2>
                <p className="mt-0.5 text-sm text-muted">{t.dashboard.payouts.activeText(formatAmount(MIN_PAYOUT_CENTS, locale))}</p>
              </div>
              <a href="/api/stripe/dashboard" target="_blank" rel="noopener" className="btn-ghost">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {t.dashboard.payouts.dashboardButton}
              </a>
            </div>
          ) : seller?.stripeAccountId ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warn-bg text-warn">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-56 flex-1">
                <h2 className="font-semibold">{t.dashboard.payouts.pendingTitle}</h2>
                <p className="mt-0.5 text-sm text-muted">{t.dashboard.payouts.pendingText}</p>
              </div>
              <a href="/api/stripe/onboarding" className="btn-accent rounded-xl px-4 py-2.5">
                {t.dashboard.payouts.continueButton}
              </a>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft">
                  <Landmark className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-semibold">{t.dashboard.payouts.setupTitle}</h2>
                  <p className="mt-0.5 text-sm text-muted">{t.dashboard.payouts.setupText}</p>
                  <p className="mt-1 text-xs text-muted">{t.dashboard.payouts.minorNote}</p>
                </div>
              </div>
              <PayoutSetupForm countries={countries} />
            </>
          )}
        </section>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Balance icon={Hourglass} label={t.dashboard.balancePending} value={formatAmount(held, locale)} help={t.dashboard.balancePendingHelp(HOLD_DAYS)} />
        <Balance icon={Wallet} label={t.dashboard.balanceAvailable} value={formatAmount(available, locale)} help={t.dashboard.balanceAvailableHelp} dark />
        <Balance icon={CheckCircle2} label={t.dashboard.balancePaid} value={formatAmount(paid, locale)} help={t.dashboard.balancePaidHelp} />
      </div>

      {isFounder && (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted">
          <Crown className="h-4 w-4 shrink-0 text-accent-hover" aria-hidden="true" />
          {t.dashboard.founderNote(FOUNDER_FEE_PERCENT, formatDate(seller.founderUntil!, locale))}
        </p>
      )}

      {payouts.length > 0 && (
        <section className="mb-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-2 font-semibold">{t.dashboard.payouts.history}</h2>
          <ul className="divide-y divide-border">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                <span className="text-muted">{formatDate(p.createdAt, locale)}</span>
                <span className="flex-1 font-bold">{formatAmount(p.amountCents, locale)}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === "PAID" ? "bg-ok-bg text-ok" : p.status === "FAILED" ? "bg-bad-bg text-bad" : "bg-surface text-muted"}`}
                >
                  {t.dashboard.payouts.status[p.status] ?? p.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="rounded-2xl border border-border bg-card px-3 py-2 sm:px-4">
        {earnings.length === 0 ? (
          <p className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
            <Receipt className="h-6 w-6" aria-hidden="true" />
            {t.dashboard.noSalesYet}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-2 py-3 font-bold">{t.dashboard.colDate}</th>
                  <th className="px-2 py-3 font-bold">{t.dashboard.colResource}</th>
                  <th className="hidden px-2 py-3 font-bold xl:table-cell">{t.dashboard.colBuyer}</th>
                  <th className="hidden px-2 py-3 text-right font-bold md:table-cell">{t.dashboard.colPrice}</th>
                  <th className="hidden px-2 py-3 text-right font-bold xl:table-cell">{t.dashboard.colTax}</th>
                  <th className="hidden px-2 py-3 text-right font-bold xl:table-cell">{t.dashboard.colFee}</th>
                  <th className="px-2 py-3 text-right font-bold">{t.dashboard.colEarnings}</th>
                  <th className="hidden px-2 py-3 font-bold sm:table-cell">{t.dashboard.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border border-t border-border">
                {earnings.map((e) => {
                  // Régularisation : vente déjà versée puis remboursée
                  const resource = e.purchase?.resource ?? e.reverses?.purchase?.resource;
                  const status = statusOf(e);
                  return (
                    <tr key={e.id} className={e.status === "CANCELED" ? "text-muted" : ""}>
                      <td className="whitespace-nowrap px-2 py-3 text-muted">{formatDate(e.createdAt, locale)}</td>
                      <td className="max-w-0 px-2 py-3">
                        {resource ? (
                          <Link href={`/resources/${resource.slug}`} className="block truncate font-semibold hover:underline">
                            {resource.title}
                          </Link>
                        ) : (
                          <span className="font-semibold">—</span>
                        )}
                        {e.reversesId && <span className="block text-xs text-bad">{t.dashboard.adjustment}</span>}
                      </td>
                      <td className="hidden px-2 py-3 xl:table-cell">
                        {e.purchase ? (
                          <>
                            <Link href={links.profile(e.purchase.user.username)} className="font-semibold hover:underline">
                              {e.purchase.user.username}
                            </Link>
                            {/* Avis sur l'acheteur (profil), une fois qu'il a téléchargé */}
                            {e.purchase.lastDownloadedAt && (
                              <Link href={links.profile(e.purchase.user.username, "BUYER")} className="mt-0.5 flex items-center gap-1 text-xs text-muted hover:text-text">
                                <Star className="h-3 w-3 text-accent" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                                {ratedBuyers.has(e.purchase.user.id) ? t.profile.editRating : t.profile.rateBuyer}
                              </Link>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-3 text-right md:table-cell">{e.grossCents ? formatAmount(e.grossCents, locale) : "—"}</td>
                      <td className="hidden whitespace-nowrap px-2 py-3 text-right text-muted xl:table-cell">{e.grossCents ? formatAmount(e.taxCents, locale) : "—"}</td>
                      <td className="hidden whitespace-nowrap px-2 py-3 text-right text-muted xl:table-cell">
                        {e.grossCents ? `${formatAmount(e.feeCents, locale)} (${e.feePercent}${locale === "fr" ? " %" : "%"})` : "—"}
                      </td>
                      <td className={`whitespace-nowrap px-2 py-3 text-right font-bold ${e.status === "CANCELED" ? "line-through" : ""}`}>
                        {formatAmount(e.amountCents, locale)}
                      </td>
                      <td className="hidden px-2 py-3 sm:table-cell">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.style}`}>{status.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {earnings.length === LIMIT && <p className="mt-3 text-xs text-muted">{t.dashboard.salesLimit(LIMIT)}</p>}
    </>
  );
}

function Balance({ icon: Icon, label, value, help, dark }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; help: string; dark?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${dark ? "border-text bg-text text-bg" : "border-border bg-card"}`}>
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${dark ? "text-bg/65" : "text-muted"}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className={`mt-0.5 text-xs ${dark ? "text-bg/65" : "text-muted"}`}>{help}</p>
    </div>
  );
}
