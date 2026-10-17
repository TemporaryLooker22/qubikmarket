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
import { AiReportView } from "@/components/AiReportView";
import { analyzeExistingResources, reviewAiFlag } from "@/app/resource-actions";
import { findUnanalyzedVersionIds, kickAiQueue, queueLength } from "@/lib/ai/run";
import { AutoRefresh } from "@/components/AutoRefresh";

// La file d'analyse IA avance en arrière-plan après la réponse (voir lib/ai/run.ts)
export const maxDuration = 120;

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.admin.title };
}

export default async function AdminPage() {
  await requireAdmin();
  const { locale, t } = await getDictionary();

  const aiFields = { id: true, aiStatus: true, aiMatch: true, aiQuality: true, aiFlagged: true, aiReport: true } as const;
  const [pending, stats, pendingVersions, flaggedLive, unanalyzed, analyzing] = await Promise.all([
    db.resource.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" }, // les plus anciennes d'abord
      include: {
        seller: { select: { username: true } },
        // Analyse IA de la version en attente
        versions: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1, select: aiFields },
      },
    }),
    db.resource.groupBy({ by: ["status"], _count: true }),
    // Nouvelles versions de ressources déjà en ligne (l'ancienne version reste téléchargeable en attendant)
    db.resourceVersion.findMany({
      where: { status: "PENDING", resource: { status: { in: ["APPROVED", "UNLISTED"] } } },
      orderBy: { createdAt: "asc" },
      include: { resource: { select: { slug: true, title: true, version: true, seller: { select: { username: true } } } } },
    }),
    // Versions en ligne signalées par l'IA (réanalyse ou ancienne ressource), pas encore examinées
    db.resourceVersion.findMany({
      where: { status: "LIVE", aiFlagged: true, aiReviewed: false, resource: { status: "APPROVED" } },
      orderBy: { aiAt: "asc" },
      include: { resource: { select: { slug: true, title: true, category: true, priceCents: true, seller: { select: { username: true } } } } },
    }),
    findUnanalyzedVersionIds(),
    queueLength(),
  ]);
  if (analyzing > 0) kickAiQueue();
  const count = (s: string) => stats.find((x) => x.status === s)?._count ?? 0;

  return (
    <>
      {analyzing > 0 && <AutoRefresh />}
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
                <AiReportView analysis={v} showTips={false} />
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

      {flaggedLive.length > 0 && (
        <>
          <h2>{t.admin.flaggedTitle}</h2>
          <p>{t.admin.flaggedText}</p>
          {flaggedLive.map((v) => (
            <article key={v.id}>
              <hr />
              <h3>
                <Link href={`/resources/${v.resource.slug}`}>{v.resource.title}</Link>
              </h3>
              <p>
                {categoryLabel(v.resource.category)} · {formatPrice(v.resource.priceCents, locale)} · {v.resource.seller.username} · v{v.version}
              </p>
              <AiReportView analysis={v} showTips={false} />
              <form action={reviewAiFlag}>
                <input type="hidden" name="versionId" value={v.id} />
                <label htmlFor={`fnote-${v.id}`}>{t.admin.note}</label>
                <br />
                <input id={`fnote-${v.id}`} name="note" placeholder={t.admin.notePh} />{" "}
                <button name="decision" value="keep">{t.admin.keep}</button>{" "}
                <button name="decision" value="unlist">{t.admin.unlist}</button>
              </form>
            </article>
          ))}
          <hr />
        </>
      )}

      {/* Ressources publiées avant l'analyse IA (ou analyse échouée) */}
      {(unanalyzed.length > 0 || analyzing > 0) && (
        <>
          <h2>{t.admin.analyzeTitle(unanalyzed.length)}</h2>
          <p>{analyzing > 0 ? t.admin.analyzeRunning(analyzing) : t.admin.analyzeText}</p>
          {unanalyzed.length > 0 && analyzing === 0 && (
            <form action={analyzeExistingResources}>
              <button>{t.admin.analyzeButton}</button>
            </form>
          )}
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
              {r.versions[0] && <AiReportView analysis={r.versions[0]} showTips={false} />}

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
