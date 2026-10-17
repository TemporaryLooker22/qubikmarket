import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { categoryLabel } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate, formatPrice, formatSize } from "@/lib/i18n/format";
import { isDemoMode } from "@/lib/payments";
import type { ScanReport } from "@/lib/scan";
import { buyResource } from "@/app/actions";
import { ScanBadge } from "@/components/ScanBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ScanReportView } from "@/components/ScanReportView";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ bought?: string }>;

export default async function ResourcePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const { bought } = await searchParams;
  const [user, { locale, t }] = await Promise.all([getCurrentUser(), getDictionary()]);

  const resource = await db.resource.findUnique({
    where: { slug },
    include: { seller: { select: { id: true, username: true } }, _count: { select: { purchases: { where: { status: "PAID" } } } } },
  });
  if (!resource) notFound();

  const isOwner = user?.id === resource.sellerId;
  const isAdmin = user?.role === "ADMIN";
  // Une ressource pas encore validée n'est visible que par son vendeur et les modérateurs
  if (resource.status !== "APPROVED" && !isOwner && !isAdmin) notFound();

  const purchase = user
    ? await db.purchase.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId: resource.id } } })
    : null;
  const canDownload = isOwner || isAdmin || purchase?.status === "PAID";
  const report = JSON.parse(resource.scanReport) as ScanReport;

  return (
    <>
      <p>
        <Link href={`/resources?category=${resource.category}`}>{categoryLabel(resource.category)}</Link>
      </p>
      <h1>{resource.title}</h1>
      <p>{resource.summary}</p>
      <p>
        {t.resource.by} <strong>{resource.seller.username}</strong> <ScanBadge verdict={resource.scanVerdict} />{" "}
        {resource.status !== "APPROVED" && <StatusBadge status={resource.status} />}
      </p>

      <h2>{formatPrice(resource.priceCents, locale)}</h2>

      {bought && <p>{t.resource.bought}</p>}

      {canDownload ? (
        <p>
          <a href={`/api/download/${resource.id}`}>{t.resource.download}</a>
        </p>
      ) : resource.status === "APPROVED" ? (
        <form action={buyResource}>
          <input type="hidden" name="resourceId" value={resource.id} />
          <button>{resource.priceCents === 0 ? t.resource.getFree : t.resource.buy}</button>
        </form>
      ) : null}

      {!user && resource.priceCents > 0 && <p>{t.resource.loginToBuy}</p>}
      {isDemoMode && resource.priceCents > 0 && !canDownload && <p>{t.resource.demo}</p>}

      <ul>
        <li>{t.resource.file}: {resource.fileName}</li>
        <li>{t.resource.size}: {formatSize(resource.fileSize, locale)}</li>
        <li>{t.resource.downloads}: {resource._count.purchases}</li>
        <li>{t.resource.published}: {formatDate(resource.createdAt, locale)}</li>
      </ul>

      {resource.reviewNote && (isOwner || isAdmin) && (
        <>
          <h2>{t.resource.reviewNote}</h2>
          <p>{resource.reviewNote}</p>
        </>
      )}

      <h2>{t.resource.description}</h2>
      <p style={{ whiteSpace: "pre-line" }}>{resource.description}</p>

      <h2>{t.resource.security}</h2>
      {isOwner || isAdmin ? (
        <ScanReportView report={report} />
      ) : (
        <p>
          {t.resource.securityPublic(report.scriptCount)}
          {resource.scanVerdict === "clean" ? t.resource.securityClean : t.resource.securityReviewed}
        </p>
      )}
    </>
  );
}
