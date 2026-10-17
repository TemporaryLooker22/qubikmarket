import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { categoryLabel } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/i18n/format";
import type { ScanReport } from "@/lib/scan";
import { moderateResource } from "@/app/actions";
import { ScanBadge } from "@/components/ScanBadge";
import { ScanReportView } from "@/components/ScanReportView";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.admin.title };
}

export default async function AdminPage() {
  await requireAdmin();
  const { locale, t } = await getDictionary();

  const [pending, stats] = await Promise.all([
    db.resource.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" }, // les plus anciennes d'abord
      include: { seller: { select: { username: true } } },
    }),
    db.resource.groupBy({ by: ["status"], _count: true }),
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
