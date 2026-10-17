import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Crown, Hourglass, Info, Receipt, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatDate } from "@/lib/i18n/format";
import { HOLD_DAYS } from "@/lib/earnings";
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
  const { locale, t } = await getDictionary();

  const [resourceCount, seller, earnings, totals] = await Promise.all([
    db.resource.count({ where: { sellerId: user.id } }),
    db.user.findUnique({ where: { id: user.id }, select: { founderUntil: true } }),
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
        purchase: { select: { status: true, user: { select: { username: true } }, resource: { select: { title: true, slug: true } } } },
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

      {/* Pas encore de versements automatiques : on le dit honnêtement */}
      <p className="mb-4 flex gap-2.5 rounded-xl bg-accent-soft px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {t.dashboard.payoutStart}
          <strong>{t.dashboard.payoutBold}</strong>
          {t.dashboard.payoutEnd}
        </span>
      </p>

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
                      <td className="hidden px-2 py-3 xl:table-cell">{e.purchase?.user.username ?? "—"}</td>
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
