import Link from "next/link";
import { redirect } from "next/navigation";
import { Info, Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatDate } from "@/lib/i18n/format";
import { PLATFORM_FEE_PERCENT, sellerNetCents } from "@/lib/payments";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.dashboard.menu.sales };
}

const LIMIT = 100; // ventes affichées dans le tableau

// Ventes : total brut, commission, gains, et le détail des dernières ventes
export default async function DashboardSalesPage() {
  const user = await requireUser("/dashboard/sales");
  const { locale, t } = await getDictionary();

  if ((await db.resource.count({ where: { sellerId: user.id } })) === 0) redirect("/dashboard/purchases");

  // Seulement les ventes payantes (les téléchargements gratuits ne sont pas des ventes)
  const where = { status: "PAID", amountCents: { gt: 0 }, resource: { sellerId: user.id } };
  const [sales, all] = await Promise.all([
    db.purchase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, amountCents: true, createdAt: true, user: { select: { username: true } }, resource: { select: { title: true, slug: true } } },
    }),
    db.purchase.findMany({ where, select: { amountCents: true } }),
  ]);

  const gross = all.reduce((n, p) => n + p.amountCents, 0);
  const net = all.reduce((n, p) => n + sellerNetCents(p.amountCents), 0);

  return (
    <>
      <DashboardHeader title={t.dashboard.menu.sales} intro={t.dashboard.salesIntro} />

      {/* Pas encore de Stripe Connect : on le dit honnêtement */}
      <p className="mb-4 flex gap-2.5 rounded-xl bg-accent-soft px-4 py-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          {t.dashboard.payoutStart}
          <strong>{t.dashboard.payoutBold}</strong>
          {t.dashboard.payoutEnd}
        </span>
      </p>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Total label={t.dashboard.gross} value={formatAmount(gross, locale)} />
        <Total label={t.dashboard.fee(PLATFORM_FEE_PERCENT)} value={`− ${formatAmount(gross - net, locale)}`} />
        <Total label={t.dashboard.net} value={formatAmount(net, locale)} dark />
      </div>

      <div className="rounded-2xl border border-border bg-card px-3 py-2 sm:px-4">
        {sales.length === 0 ? (
          <p className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
            <Receipt className="h-6 w-6" aria-hidden="true" />
            {t.dashboard.noSalesYet}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-muted">
                <th className="px-2 py-3 font-bold">{t.dashboard.colDate}</th>
                <th className="px-2 py-3 font-bold">{t.dashboard.colResource}</th>
                <th className="hidden px-2 py-3 font-bold sm:table-cell">{t.dashboard.colBuyer}</th>
                <th className="hidden px-2 py-3 text-right font-bold sm:table-cell">{t.dashboard.colPrice}</th>
                <th className="px-2 py-3 text-right font-bold">{t.dashboard.colEarnings}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border border-t border-border">
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap px-2 py-3 text-muted">{formatDate(s.createdAt, locale)}</td>
                  <td className="max-w-0 px-2 py-3">
                    <Link href={`/resources/${s.resource.slug}`} className="block truncate font-semibold hover:underline">
                      {s.resource.title}
                    </Link>
                  </td>
                  <td className="hidden px-2 py-3 sm:table-cell">{s.user.username}</td>
                  <td className="hidden whitespace-nowrap px-2 py-3 text-right sm:table-cell">{formatAmount(s.amountCents, locale)}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-bold">{formatAmount(sellerNetCents(s.amountCents), locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {all.length > LIMIT && <p className="mt-3 text-xs text-muted">{t.dashboard.salesLimit(LIMIT)}</p>}
    </>
  );
}

function Total({ label, value, dark }: { label: string; value: string; dark?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${dark ? "border-text bg-text text-bg" : "border-border bg-card"}`}>
      <p className={`text-xs font-semibold ${dark ? "text-bg/65" : "text-muted"}`}>{label}</p>
      <p className="mt-1.5 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
