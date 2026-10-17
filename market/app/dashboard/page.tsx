import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatPrice } from "@/lib/i18n/format";
import { PLATFORM_FEE_PERCENT } from "@/lib/payments";
import { ScanBadge } from "@/components/ScanBadge";
import { StatusBadge } from "@/components/StatusBadge";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.dashboard.title };
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ published?: string }> }) {
  const user = await requireUser();
  const [{ published }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);

  const [resources, purchases] = await Promise.all([
    db.resource.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { purchases: { where: { status: "PAID" }, select: { amountCents: true } } },
    }),
    db.purchase.findMany({
      where: { userId: user.id, status: "PAID" },
      orderBy: { createdAt: "desc" },
      include: { resource: { select: { id: true, slug: true, title: true } } },
    }),
  ]);

  const grossCents = resources.flatMap((r) => r.purchases).reduce((sum, p) => sum + p.amountCents, 0);
  const netCents = Math.round(grossCents * (1 - PLATFORM_FEE_PERCENT / 100));
  const sales = resources.reduce((n, r) => n + r.purchases.length, 0);
  const message = published ? t.dashboard.published[published] : null;

  return (
    <>
      <h1>{t.dashboard.hello(user.username)}</h1>
      <p>
        <Link href="/sell">{t.dashboard.newResource}</Link>
      </p>

      {message && <p role="status">{message}</p>}

      <ul>
        <li>{t.dashboard.statPublished}: {resources.filter((r) => r.status === "APPROVED").length}</li>
        <li>{t.dashboard.statSales}: {sales}</li>
        <li>
          {t.dashboard.statRevenue(PLATFORM_FEE_PERCENT)}: {formatAmount(netCents, locale)}
        </li>
      </ul>

      <h2>{t.dashboard.myResources}</h2>
      {resources.length === 0 ? (
        <p>{t.dashboard.noResources}</p>
      ) : (
        <ul>
          {resources.map((r) => (
            <li key={r.id}>
              <Link href={`/resources/${r.slug}`}>{r.title}</Link> · {formatPrice(r.priceCents, locale)}{" "}
              <ScanBadge verdict={r.scanVerdict} /> <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}

      <h2>{t.dashboard.myPurchases}</h2>
      {purchases.length === 0 ? (
        <p>
          {t.dashboard.noPurchases} <Link href="/resources">{t.dashboard.explore}</Link>
        </p>
      ) : (
        <ul>
          {purchases.map((p) => (
            <li key={p.id}>
              <Link href={`/resources/${p.resource.slug}`}>{p.resource.title}</Link> · {formatPrice(p.amountCents, locale)} ·{" "}
              <a href={`/api/download/${p.resource.id}`}>{t.dashboard.download}</a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
