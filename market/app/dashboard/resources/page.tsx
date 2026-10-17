import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, Eye, EyeOff, Package, Pencil, ShieldCheck, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { setListed } from "@/app/actions";
import { categoryLabel } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatPrice } from "@/lib/i18n/format";
import type { ScanReport } from "@/lib/scan";
import { ScanReportView } from "@/components/ScanReportView";
import { AiReportView } from "@/components/AiReportView";
import { StatusBadge } from "@/components/StatusBadge";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { RowMenu } from "@/components/dashboard/RowMenu";
import { Thumb } from "@/components/dashboard/Thumb";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.dashboard.menu.resources };
}

const STATUSES = ["ANALYZING", "APPROVED", "PENDING", "REJECTED", "UNLISTED"];
const menuItem = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition hover:bg-surface";

// Mes ressources : filtres par statut, ventes et revenus par ressource, menu d'actions et rapport de scan
export default async function DashboardResourcesPage({ searchParams }: { searchParams: Promise<{ status?: string; report?: string }> }) {
  const user = await requireUser("/dashboard/resources");
  const [{ status, report: reportId }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);

  const all = await db.resource.findMany({
    where: { sellerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      category: true,
      priceCents: true,
      status: true,
      images: true,
      reviewNote: true,
      purchases: { where: { status: "PAID" }, select: { earning: { select: { amountCents: true } } } },
    },
  });
  if (all.length === 0) redirect("/dashboard/purchases");

  // Le rapport complet (gros JSON) n'est chargé que pour la ressource ouverte
  const opened = reportId && all.some((r) => r.id === reportId)
    ? await db.resource.findUnique({
        where: { id: reportId },
        select: {
          scanReport: true,
          // Analyse IA de la dernière version envoyée (en ligne, en analyse ou en vérification)
          versions: {
            where: { status: { in: ["LIVE", "ANALYZING", "PENDING"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { aiStatus: true, aiMatch: true, aiQuality: true, aiFlagged: true, aiReport: true },
          },
        },
      })
    : null;
  const report = opened ? (JSON.parse(opened.scanReport) as ScanReport) : null;

  const filter = status && STATUSES.includes(status) ? status : "all";
  const list = filter === "all" ? all : all.filter((r) => r.status === filter);
  const count = (s: string) => (s === "all" ? all.length : all.filter((r) => r.status === s).length);
  // Lien qui garde le filtre en cours (et ouvre éventuellement un rapport)
  const href = (params: { status?: string; report?: string }) => {
    const q = new URLSearchParams();
    if (params.status && params.status !== "all") q.set("status", params.status);
    if (params.report) q.set("report", params.report);
    return `/dashboard/resources${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <DashboardHeader title={t.dashboard.menu.resources} intro={t.dashboard.resourcesIntro} newResource={t.dashboard.newResource} />

      {/* Filtres par statut (seulement ceux qui ont des ressources) */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["all", ...STATUSES]
          .filter((s) => s === "all" || count(s) > 0)
          .map((s) => (
            <Link
              key={s}
              href={href({ status: s })}
              aria-current={filter === s ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${
                filter === s ? "border-text bg-text text-bg" : "border-border bg-card text-muted hover:border-border-strong hover:text-text"
              }`}
            >
              {t.dashboard.filters[s]} · {count(s)}
            </Link>
          ))}
      </div>

      <div className="rounded-2xl border border-border bg-card px-4 py-2 sm:px-5">
        {/* En-têtes de colonnes (ordinateur) */}
        <div className="hidden grid-cols-[84px_minmax(0,1fr)_128px_64px_96px_32px] gap-4 border-b border-border py-3 text-[11px] font-bold uppercase tracking-wider text-muted md:grid">
          <span />
          <span>{t.dashboard.colResource}</span>
          <span>{t.dashboard.colStatus}</span>
          <span className="text-right">{t.dashboard.colSales}</span>
          <span className="text-right">{t.dashboard.colRevenue}</span>
          <span />
        </div>

        {list.length === 0 && (
          <p className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
            <Package className="h-6 w-6" aria-hidden="true" />
            {t.dashboard.noResourcesFilter}
          </p>
        )}

        <ul className="divide-y divide-border">
          {list.map((r) => {
            const sales = r.purchases.length;
            const net = r.purchases.reduce((n, p) => n + (p.earning?.amountCents ?? 0), 0);
            const showReport = report !== null && reportId === r.id;
            return (
              <li key={r.id} id={r.id} className="scroll-mt-28 py-3">
                <div className="grid grid-cols-[64px_minmax(0,1fr)_32px] items-center gap-3 md:grid-cols-[84px_minmax(0,1fr)_128px_64px_96px_32px] md:gap-4">
                  <Thumb image={r.images[0]} category={r.category} className="w-16 md:w-[84px]" />
                  <div className="min-w-0">
                    <Link href={`/resources/${r.slug}`} className="block truncate font-semibold hover:underline">
                      {r.title}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {categoryLabel(r.category)} · {formatPrice(r.priceCents, locale)}
                    </p>
                    {/* Sur téléphone, le statut et les chiffres passent sous le titre */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted md:hidden">
                      <StatusBadge status={r.status} />
                      <span>{t.card.sales(sales)}</span>
                      {net > 0 && <span>· {formatAmount(net, locale)}</span>}
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <StatusBadge status={r.status} />
                  </div>
                  <span className="hidden text-right text-sm font-semibold md:block">{sales}</span>
                  <span className="hidden text-right text-sm font-semibold md:block">{net > 0 ? formatAmount(net, locale) : "—"}</span>

                  <RowMenu label={`${t.dashboard.actions} : ${r.title}`}>
                    <Link role="menuitem" href={`/resources/${r.slug}`} className={menuItem}>
                      <ExternalLink className="h-4 w-4 text-muted" aria-hidden="true" />
                      {t.dashboard.viewPage}
                    </Link>
                    <Link role="menuitem" href={`${href({ status: filter, report: showReport ? undefined : r.id })}#${r.id}`} scroll={false} className={menuItem}>
                      <ShieldCheck className="h-4 w-4 text-muted" aria-hidden="true" />
                      {showReport ? t.dashboard.hideReport : t.dashboard.scanReport}
                    </Link>
                    <hr className="mx-1.5 my-1 border-border" />
                    <Link role="menuitem" href={`/dashboard/resources/${r.id}/edit`} className={menuItem}>
                      <Pencil className="h-4 w-4 text-muted" aria-hidden="true" />
                      {t.dashboard.edit}
                    </Link>
                    <Link role="menuitem" href={`/dashboard/resources/${r.id}/edit?tab=versions`} className={menuItem}>
                      <Upload className="h-4 w-4 text-muted" aria-hidden="true" />
                      {t.dashboard.newVersion}
                    </Link>
                    {(r.status === "APPROVED" || r.status === "UNLISTED") && (
                      <>
                        <hr className="mx-1.5 my-1 border-border" />
                        <form action={setListed}>
                          <input type="hidden" name="resourceId" value={r.id} />
                          <input type="hidden" name="listed" value={r.status === "UNLISTED" ? "1" : "0"} />
                          <button type="submit" role="menuitem" className={menuItem}>
                            {r.status === "UNLISTED" ? <Eye className="h-4 w-4 text-muted" aria-hidden="true" /> : <EyeOff className="h-4 w-4 text-muted" aria-hidden="true" />}
                            <span>
                              {r.status === "UNLISTED" ? t.dashboard.relist : t.dashboard.unlist}
                              {r.status === "APPROVED" && <span className="mt-0.5 block text-[11.5px] font-normal text-muted">{t.dashboard.unlistHelp}</span>}
                            </span>
                          </button>
                        </form>
                      </>
                    )}
                  </RowMenu>
                </div>

                {/* Rapport de scan (et note du modérateur), ouvert depuis le menu */}
                {showReport && (
                  <div className="animate-pop mt-3 rounded-xl bg-bg p-4">
                    {r.reviewNote && (
                      <p className="mb-3 rounded-lg border border-border bg-card px-3 py-2 text-sm">
                        <strong>{t.dashboard.reviewNote}</strong> {r.reviewNote}
                      </p>
                    )}
                    <ScanReportView report={report} />
                    {opened?.versions[0] && (
                      <div className="mt-4">
                        <AiReportView analysis={opened.versions[0]} />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
