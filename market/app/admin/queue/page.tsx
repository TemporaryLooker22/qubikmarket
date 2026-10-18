import Link from "next/link";
import Image from "next/image";
import { Download, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { categoryLabel } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate, formatPrice } from "@/lib/i18n/format";
import type { ScanReport } from "@/lib/scan";
import { QUEUE_RESOURCES, QUEUE_VERSIONS } from "@/lib/moderation";
import { moderateResource } from "@/app/actions";
import { moderateVersion } from "@/app/resource-actions";
import { AiReportView } from "@/components/AiReportView";
import { Markdown } from "@/components/Markdown";
import { ScanBadge } from "@/components/ScanBadge";
import { ScanReportView } from "@/components/ScanReportView";
import { Thumb } from "@/components/dashboard/Thumb";
import { AiBadge, Badge, PageTitle } from "@/components/admin/AdminUi";
import { DecisionForm } from "@/components/admin/DecisionForm";

const aiFields = { id: true, aiStatus: true, aiMatch: true, aiQuality: true, aiFlagged: true, aiReport: true } as const;
const resourceFields = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  description: true,
  category: true,
  priceCents: true,
  images: true,
  version: true,
  sellerId: true,
  seller: { select: { username: true, createdAt: true } },
} as const;

// Modération → À vérifier : liste à gauche (nouvelles ressources et nouvelles versions, la plus ancienne d'abord),
// détail et décision à droite. Après une décision, l'élément suivant s'affiche tout seul.
export default async function AdminQueuePage({ searchParams }: { searchParams: Promise<{ item?: string; type?: string }> }) {
  const [{ item, type }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);

  const [resources, versions] = await Promise.all([
    db.resource.findMany({
      where: QUEUE_RESOURCES,
      orderBy: { createdAt: "asc" },
      select: { ...resourceFields, createdAt: true, scanVerdict: true, scanReport: true, versions: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1, select: aiFields } },
    }),
    db.resourceVersion.findMany({
      where: QUEUE_VERSIONS,
      orderBy: { createdAt: "asc" },
      select: { ...aiFields, version: true, notes: true, createdAt: true, scanVerdict: true, scanReport: true, resource: { select: resourceFields } },
    }),
  ]);

  // Une seule liste pour les deux sortes d'éléments
  const all = [
    ...resources.map((r) => ({ key: `r_${r.id}`, kind: "resources" as const, createdAt: r.createdAt, resource: r, scanVerdict: r.scanVerdict, scanReport: r.scanReport, ai: r.versions[0] ?? null, version: null as null | { id: string; version: string; notes: string | null } })),
    ...versions.map((v) => ({ key: `v_${v.id}`, kind: "versions" as const, createdAt: v.createdAt, resource: v.resource, scanVerdict: v.scanVerdict, scanReport: v.scanReport, ai: v, version: { id: v.id, version: v.version, notes: v.notes } })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const filter = type === "resources" || type === "versions" ? type : "all";
  const list = filter === "all" ? all : all.filter((x) => x.kind === filter);
  const selected = list.find((x) => x.key === item) ?? list[0];

  // Le vendeur de l'élément ouvert : ressources et ventes
  const sellerStats = selected
    ? await Promise.all([
        db.resource.count({ where: { sellerId: selected.resource.sellerId } }),
        db.purchase.count({ where: { status: "PAID", resource: { sellerId: selected.resource.sellerId } } }),
      ])
    : null;

  const now = Date.now();
  const waitOf = (d: Date) => t.mod.ago(t.mod.hours(Math.floor((now - d.getTime()) / 36e5)));
  const href = (params: { item?: string; type?: string }) => {
    const q = new URLSearchParams();
    if (params.type && params.type !== "all") q.set("type", params.type);
    if (params.item) q.set("item", params.item);
    return `/admin/queue${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <PageTitle title={t.mod.menu.queue} intro={t.mod.queueIntro} />

      {all.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-card px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-bg text-ok">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-3 font-semibold">{t.mod.queueEmpty}</p>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* Liste */}
          <div className="rounded-2xl border border-border bg-card p-2 xl:sticky xl:top-24">
            <div className="flex flex-wrap gap-1.5 p-1.5">
              {(["all", "resources", "versions"] as const).map((f) => {
                const n = f === "all" ? all.length : all.filter((x) => x.kind === f).length;
                return (
                  <Link
                    key={f}
                    href={href({ type: f })}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${filter === f ? "border-text bg-text text-bg" : "border-border text-muted hover:text-text"}`}
                  >
                    {t.mod.filters[f]} · {n}
                  </Link>
                );
              })}
            </div>
            <ul className="space-y-0.5">
              {list.map((x) => (
                <li key={x.key}>
                  <Link
                    href={href({ type: filter, item: x.key })}
                    scroll={false}
                    aria-current={x.key === selected?.key ? "true" : undefined}
                    className={`grid grid-cols-[64px_minmax(0,1fr)] gap-2.5 rounded-xl p-2 transition ${x.key === selected?.key ? "bg-accent-soft" : "hover:bg-bg"}`}
                  >
                    <Thumb image={x.resource.images[0]} category={x.resource.category} className="w-16" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        <span className="truncate">{x.resource.title}</span>
                        {x.version && <Badge tone="accent">v{x.version.version}</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {x.resource.seller.username} · {waitOf(x.createdAt)}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <ScanBadge verdict={x.scanVerdict} />
                        {x.ai && <AiBadge status={x.ai.aiStatus} match={x.ai.aiMatch} quality={x.ai.aiQuality} flagged={x.ai.aiFlagged} failedLabel={t.ai.failed} />}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Détail de l'élément ouvert */}
          {selected && (
            <div className="min-w-0 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    {categoryLabel(selected.resource.category)} · {formatPrice(selected.resource.priceCents, locale)} ·{" "}
                    {selected.version ? t.mod.newVersion(selected.version.version, selected.resource.version) : t.mod.newResource}
                  </p>
                  <h2 className="mt-0.5 text-xl font-semibold tracking-tight">{selected.resource.title}</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {t.resource.by("")}
                    <Link href={`/admin/users?id=${selected.resource.sellerId}`} className="font-medium text-text underline-offset-2 hover:underline">
                      {selected.resource.seller.username}
                    </Link>{" "}
                    ({t.mod.sellerInfo(sellerStats![0], sellerStats![1], formatDate(selected.resource.seller.createdAt, locale))}) · {waitOf(selected.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Link href={`/resources/${selected.resource.slug}`} className="btn-ghost px-3 py-2 text-sm" target="_blank">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    {t.mod.viewPage}
                  </Link>
                  <a href={`/api/download/${selected.resource.id}${selected.version ? `?version=${selected.version.id}` : ""}`} className="btn-ghost px-3 py-2 text-sm">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {t.mod.file}
                  </a>
                </div>
              </div>

              {/* Images et description (nouvelle ressource) ou notes de version */}
              {selected.version ? (
                selected.version.notes && (
                  <div className="mt-4 rounded-xl bg-bg p-4 text-sm">
                    <p className="mb-1 font-semibold">{t.mod.notes}</p>
                    <p className="whitespace-pre-line">{selected.version.notes}</p>
                  </div>
                )
              ) : (
                <>
                  {selected.resource.images.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {selected.resource.images.slice(0, 3).map((src) => (
                        <div key={src} className="relative aspect-video overflow-hidden rounded-lg bg-surface">
                          <Image src={src} alt="" fill sizes="240px" className="object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-4 text-sm font-medium">{selected.resource.summary}</p>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-muted hover:text-text">{t.resource.description}</summary>
                    <div className="mt-2 max-h-80 overflow-y-auto rounded-xl bg-bg p-4">
                      <Markdown>{selected.resource.description}</Markdown>
                    </div>
                  </details>
                </>
              )}

              <div className="mt-4 rounded-xl bg-bg p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {t.mod.scanTitle}
                </p>
                <ScanReportView report={JSON.parse(selected.scanReport) as ScanReport} />
              </div>
              {selected.ai && (
                <div className="mt-3">
                  <AiReportView analysis={selected.ai} showTips={false} />
                </div>
              )}
              {!selected.ai && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {t.ai.failed}
                </p>
              )}

              <div className="mt-4">
                <DecisionForm
                  key={selected.key}
                  sticky
                  action={selected.version ? moderateVersion : moderateResource}
                  hidden={selected.version ? { versionId: selected.version.id } : { resourceId: selected.resource.id }}
                  choices={[
                    { value: "approve", label: t.admin.approve, tone: "approve" },
                    { value: "reject", label: t.admin.reject, tone: "reject" },
                  ]}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
