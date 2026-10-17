import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { categoryLabel } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/i18n/format";
import type { ScanReport } from "@/lib/scan";
import { moderateResource } from "@/app/actions";
import { moderateVersion } from "@/app/resource-actions";
import { ScanBadge } from "@/components/ScanBadge";
import { ScanReportView } from "@/components/ScanReportView";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.admin.title };
}

export default async function AdminPage() {
  await requireAdmin();
  const { locale, t } = await getDictionary();

  const [pending, stats, pendingVersions] = await Promise.all([
    db.resource.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" }, // les plus anciennes d'abord
      include: { seller: { select: { username: true } } },
    }),
    db.resource.groupBy({ by: ["status"], _count: true }),
    // Nouvelles versions de ressources déjà en ligne (l'ancienne version reste téléchargeable en attendant)
    db.resourceVersion.findMany({
      where: { status: "PENDING", resource: { status: { in: ["APPROVED", "UNLISTED"] } } },
      orderBy: { createdAt: "asc" },
      include: { resource: { select: { slug: true, title: true, version: true, seller: { select: { username: true } } } } },
    }),
  ]);
  const count = (s: string) => stats.find((x) => x.status === s)?._count ?? 0;

  return (
    <>
      <h1>{t.admin.title}</h1>
      <p>{t.admin.intro}</p>

      <ul>
        <li>{t.admin.pending}: {count("PENDING")}</li>
        <li>{t.admin.live}: {count("APPROVED")}</li>
        <li>{t.admin.rejected}: {count("REJECTED")}</li>
      </ul>

      {pendingVersions.length > 0 && (
        <>
          <h2>{t.admin.versionsTitle}</h2>
          {pendingVersions.map((v) => {
            const waitingHours = Math.round((Date.now() - v.createdAt.getTime()) / 36e5);
            return (
              <article key={v.id}>
                <hr />
                <h3>
                  <Link href={`/resources/${v.resource.slug}`}>{v.resource.title}</Link> <ScanBadge verdict={v.scanVerdict} />
                </h3>
                <p>{t.admin.versionMeta(v.version, v.resource.version, v.resource.seller.username, waitingHours)}</p>
                {v.notes && <p>{v.notes}</p>}
                <ScanReportView report={JSON.parse(v.scanReport) as ScanReport} />
                <form action={moderateVersion}>
                  <input type="hidden" name="versionId" value={v.id} />
                  <label htmlFor={`vnote-${v.id}`}>{t.admin.note}</label>
                  <br />
                  <input id={`vnote-${v.id}`} name="note" placeholder={t.admin.notePh} />{" "}
                  <button name="decision" value="approve">{t.admin.approve}</button>{" "}
                  <button name="decision" value="reject">{t.admin.reject}</button>
                </form>
              </article>
            );
          })}
          <hr />
        </>
      )}

      {pending.length === 0 ? (
        <p>{t.admin.empty}</p>
      ) : (
        pending.map((r) => {
          const report = JSON.parse(r.scanReport) as ScanReport;
          const waitingHours = Math.round((Date.now() - r.createdAt.getTime()) / 36e5);
          return (
            <article key={r.id}>
              <hr />
              <h2>
                <Link href={`/resources/${r.slug}`}>{r.title}</Link> <ScanBadge verdict={r.scanVerdict} />
              </h2>
              <p>{t.admin.meta(categoryLabel(r.category), formatPrice(r.priceCents, locale), r.seller.username, waitingHours)}</p>

              <ScanReportView report={report} />

              <form action={moderateResource}>
                <input type="hidden" name="resourceId" value={r.id} />
                <label htmlFor={`note-${r.id}`}>{t.admin.note}</label>
                <br />
                <input id={`note-${r.id}`} name="note" placeholder={t.admin.notePh} />{" "}
                <button name="decision" value="approve">{t.admin.approve}</button>{" "}
                <button name="decision" value="reject">{t.admin.reject}</button>
              </form>
            </article>
          );
        })
      )}
    </>
  );
}
