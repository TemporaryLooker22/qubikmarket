import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download, ExternalLink, FileText, History, Image as ImageIcon, Info, Tag } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MAX_IMAGES } from "@/lib/catalog";
import { feePercentFor } from "@/lib/earnings";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate, formatSize } from "@/lib/i18n/format";
import type { ScanReport } from "@/lib/scan";
import { latestVersion, suggestNextVersion } from "@/lib/versions";
import { ScanBadge } from "@/components/ScanBadge";
import { ScanReportView } from "@/components/ScanReportView";
import { StatusBadge } from "@/components/StatusBadge";
import { Thumb } from "@/components/dashboard/Thumb";
import { DescriptionForm, ImagesForm, InfoForm, PriceForm } from "@/components/edit/EditForms";
import { PublishVersionForm } from "@/components/edit/PublishVersionForm";
import { QueueLabel } from "@/components/AiReportView";
import { AutoRefresh } from "@/components/AutoRefresh";
import { kickAiQueue, queueSpots } from "@/lib/ai/run";


// La file d'analyse IA avance en arrière-plan après la réponse (voir lib/ai/run.ts)
export const maxDuration = 120;
export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.edit.metaTitle };
}

const TABS = ["info", "images", "description", "price", "versions"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICONS = { info: Info, images: ImageIcon, description: FileText, price: Tag, versions: History };
const VERSION_STYLES: Record<string, string> = {
  ANALYZING: "bg-accent-soft text-text",
  LIVE: "bg-ok-bg text-ok",
  OLD: "bg-surface text-muted",
  PENDING: "bg-warn-bg text-warn",
  REJECTED: "bg-bad-bg text-bad",
};

// Modifier une ressource : onglets Infos, Images, Description, Prix et Versions (Mon espace → Mes ressources)
export default async function EditResourcePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: tabParam }] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/dashboard/resources/${id}/edit`);
  const { locale, t } = await getDictionary();

  const [resource, seller] = await Promise.all([
    db.resource.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { createdAt: "desc" } },
        _count: { select: { purchases: { where: { status: "PAID" } } } },
      },
    }),
    db.user.findUnique({ where: { id: user.id }, select: { founderUntil: true } }),
  ]);
  // Seul le vendeur peut modifier sa ressource
  if (!resource || resource.sellerId !== user.id) notFound();

  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "info";
  const pendingVersions = resource.versions.filter((v) => v.status === "PENDING").length;
  const current = resource.versions.find((v) => v.version === resource.version);
  // Versions dans la file d'attente de vérification IA : leur place s'affiche dans l'historique
  const spots = await queueSpots(resource.versions.filter((v) => v.aiStatus === "QUEUED" || v.aiStatus === "PENDING").map((v) => v.id));
  if (spots.size > 0) kickAiQueue();
  const feePercent = feePercentFor({ founderUntil: seller?.founderUntil ?? null }, new Date());

  return (
    <>
      {spots.size > 0 && <AutoRefresh />}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/dashboard/resources" className="hover:text-text">
          {t.dashboard.menu.resources}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span aria-current="page">{t.edit.metaTitle}</span>
      </nav>

      {/* En-tête : la ressource et son état */}
      <div className="mb-5 mt-3 flex flex-wrap items-center gap-4">
        <Thumb image={resource.images[0]} category={resource.category} className="w-24" />
        <div className="min-w-56 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{resource.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={resource.status} />
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">v{resource.version}</span>
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted">{t.card.sales(resource._count.purchases)}</span>
          </div>
        </div>
        <Link href={`/resources/${resource.slug}`} className="btn-ghost">
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {t.dashboard.viewPage}
        </Link>
      </div>

      {/* Onglets (chacun a sa propre adresse : ?tab=…) */}
      <nav aria-label={t.edit.metaTitle} className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {TABS.map((id) => {
          const Icon = TAB_ICONS[id];
          const active = id === tab;
          return (
            <Link
              key={id}
              href={`?tab=${id}`}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-sm font-semibold transition ${active ? "text-text" : "text-muted hover:text-text"}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t.edit.tabs[id]}
              {id === "versions" && pendingVersions > 0 && (
                <span className="rounded-full bg-warn-bg px-1.5 text-[10.5px] font-bold text-warn">{t.edit.pendingBadge(pendingVersions)}</span>
              )}
              {active && <span className="absolute inset-x-2.5 -bottom-px h-[3px] rounded-t bg-accent" aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>

      {tab === "info" && (
        <Card title={t.sell.infoTitle} text={t.sell.infoText}>
          <InfoForm resourceId={resource.id} initial={{ title: resource.title, summary: resource.summary, category: resource.category }} />
        </Card>
      )}
      {tab === "images" && (
        <Card title={t.sell.imagesTitle} text={t.sell.imagesText(MAX_IMAGES)}>
          <ImagesForm resourceId={resource.id} initial={resource.images} />
        </Card>
      )}
      {tab === "description" && (
        <Card title={t.sell.descTitle} text={t.sell.descText}>
          <DescriptionForm resourceId={resource.id} initial={resource.description} />
        </Card>
      )}
      {tab === "price" && (
        <Card title={t.sell.priceTitle} text={t.edit.priceText}>
          <PriceForm resourceId={resource.id} initialCents={resource.priceCents} feePercent={feePercent} />
        </Card>
      )}

      {tab === "versions" && (
        <>
          <Card title={t.edit.currentTitle} text={t.edit.currentText}>
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4">
              <span className="text-2xl font-extrabold tracking-tight">v{resource.version}</span>
              <div className="min-w-48 flex-1">
                <p className="truncate font-semibold">{resource.fileName}</p>
                <p className="text-xs text-muted">{t.edit.currentMeta(formatSize(resource.fileSize, locale), formatDate(current?.createdAt ?? resource.createdAt, locale))}</p>
              </div>
              <ScanBadge verdict={resource.scanVerdict} />
              <a href={`/api/download/${resource.id}`} className="btn-ghost">
                <Download className="h-4 w-4" aria-hidden="true" />
                {t.dashboard.download}
              </a>
            </div>
          </Card>

          <Card title={t.edit.newTitle} text={t.edit.newText}>
            <PublishVersionForm resourceId={resource.id} currentVersion={resource.version} suggestion={suggestNextVersion(latestVersion(resource.versions.map((v) => v.version)))} />
          </Card>

          <Card title={t.edit.history} text={t.edit.historyText}>
            <ul className="divide-y divide-border">
              {resource.versions.map((v) => (
                <li key={v.id} className="py-3.5">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={`w-16 shrink-0 font-extrabold ${v.status === "REJECTED" ? "text-bad" : ""}`}>v{v.version}</span>
                    <div className="min-w-48 flex-1">
                      <p className="text-xs text-muted">
                        {formatDate(v.createdAt, locale)} · {v.fileName}
                      </p>
                      {v.notes && <p className="mt-1 whitespace-pre-line text-sm">{v.notes}</p>}
                      {v.reviewNote && <p className="mt-1 text-sm text-bad">{v.reviewNote}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${VERSION_STYLES[v.status] ?? VERSION_STYLES.OLD}`}>
                        {t.edit.versionStatus[v.status] ?? v.status}
                      </span>
                      {spots.get(v.id) && <QueueLabel spot={spots.get(v.id)!} />}
                    </div>
                  </div>
                  {/* Rapport de scan de la version (ouvrable) */}
                  {v.scanVerdict !== "clean" && (
                    <details className="ml-0 mt-2 sm:ml-[76px]">
                      <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-text">{t.edit.seeReport}</summary>
                      <div className="mt-2 rounded-xl bg-bg p-3">
                        <ScanReportView report={JSON.parse(v.scanReport) as ScanReport} />
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

function Card({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-semibold">{title}</h2>
      <p className="mb-5 mt-0.5 text-sm text-muted">{text}</p>
      {children}
    </section>
  );
}
