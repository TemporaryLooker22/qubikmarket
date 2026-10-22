import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CircleCheck, EyeOff, ExternalLink, Eye, Package, Pencil, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { REAL_SALE } from "@/lib/sales";
import { CATEGORIES, categoryLabel } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatPrice } from "@/lib/i18n/format";
import { adminApprove, adminDelete, adminReanalyze, adminRelist, adminUnlist } from "@/app/moderation-actions";
import { StatusBadge } from "@/components/StatusBadge";
import { RowMenu } from "@/components/dashboard/RowMenu";
import { Thumb } from "@/components/dashboard/Thumb";
import { AiBadge, PageTitle } from "@/components/admin/AdminUi";
import { BulkBar, ConfirmButton, SelectAll } from "@/components/admin/ResourceBulk";

// La file d'analyse IA avance en arrière-plan (bouton « Relancer l'analyse IA »)
export const maxDuration = 120;

const STATUSES = ["APPROVED", "ANALYZING", "PENDING", "REJECTED", "UNLISTED"];
const PAGE = 50;
const menuItem = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50";

type Search = { q?: string; status?: string; category?: string; seller?: string; limit?: string };

// Modération → Ressources : toutes les ressources de tous les vendeurs, avec recherche, filtres, chiffres
// et actions (modifier, retirer ou remettre en vente, relancer l'IA, supprimer), une par une ou groupées
export default async function AdminResourcesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [params, { locale, t }] = await Promise.all([searchParams, getDictionary()]);
  const q = params.q?.trim() ?? "";
  const status = STATUSES.includes(params.status ?? "") ? params.status! : "";
  const category = CATEGORIES.some((c) => c.id === params.category) ? params.category! : "";
  const limit = Math.min(Math.max(Number(params.limit) || PAGE, PAGE), 500);

  const where: Prisma.ResourceWhereInput = {
    ...(status && { status }),
    ...(category && { category }),
    ...(params.seller && { sellerId: params.seller }),
    ...(q && {
      OR: [{ title: { contains: q, mode: "insensitive" as const } }, { seller: { username: { contains: q, mode: "insensitive" as const } } }],
    }),
  };
  const [total, resources] = await Promise.all([
    db.resource.count({ where }),
    db.resource.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, include: { seller: { select: { id: true, username: true } } } }),
  ]);
  const ids = resources.map((r) => r.id);

  // Chiffres de chaque ressource : ventes payées, encaissé, achats qui bloquent la suppression, analyse IA de la version en ligne
  const [sales, locked, versions] = ids.length
    ? await Promise.all([
        db.purchase.groupBy({ by: ["resourceId"], where: { resourceId: { in: ids }, ...REAL_SALE }, _count: true, _sum: { amountCents: true } }),
        db.purchase.groupBy({ by: ["resourceId"], where: { resourceId: { in: ids }, status: { not: "PENDING" } }, _count: true }),
        db.resourceVersion.findMany({
          where: { OR: resources.map((r) => ({ resourceId: r.id, version: r.version })) },
          select: { resourceId: true, aiStatus: true, aiMatch: true, aiQuality: true, aiDescription: true, aiFlagged: true },
        }),
      ])
    : [[], [], []];
  const salesOf = new Map(sales.map((s) => [s.resourceId, s]));
  const lockedIds = new Set(locked.map((l) => l.resourceId));
  const aiOf = new Map(versions.map((v) => [v.resourceId, v]));
  const sellerName = params.seller ? resources[0]?.seller.username : null;

  const href = (next: Partial<Search>) => {
    const p = new URLSearchParams();
    const merged = { q, status, category, seller: params.seller ?? "", ...next };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, String(v));
    return `/admin/resources${p.size ? `?${p}` : ""}`;
  };
  const select = "h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-text";

  return (
    <>
      <PageTitle title={t.mod.menu.resources} intro={sellerName ? `${t.mod.colSeller} : ${sellerName}` : t.mod.resourcesIntro} />

      {/* Recherche et filtres (envoyés dans l'adresse) */}
      <form action="/admin/resources" className="mb-4 flex flex-wrap gap-2">
        {params.seller && <input type="hidden" name="seller" value={params.seller} />}
        <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 focus-within:border-text">
          <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span className="sr-only">{t.mod.searchResources}</span>
          <input name="q" type="search" defaultValue={q} placeholder={t.mod.searchResources} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <select name="status" defaultValue={status} aria-label={t.mod.colStatus} className={select}>
          <option value="">{t.mod.allStatuses}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.status[s as keyof typeof t.status]}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={category} aria-label={t.catalog.categories} className={select}>
          <option value="">{t.mod.allCategories}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <button className="btn h-10 px-4 text-sm">{t.mod.search}</button>
      </form>

      {/* Une seule grande forme : les cases cochées partent avec les actions groupées ; un bouton de ligne a son action liée à sa ressource */}
      <form>
        <BulkBar unlist={adminUnlist.bind(null, null)} relist={adminRelist.bind(null, null)} reanalyze={adminReanalyze.bind(null, null)} />

        <div className="rounded-2xl border border-border bg-card px-3 py-1 sm:px-4">
          <div className="hidden grid-cols-[20px_64px_minmax(0,1fr)_120px_110px_96px_64px_88px_32px] items-center gap-3 border-b border-border py-3 text-[11px] font-bold uppercase tracking-wider text-muted lg:grid">
            <SelectAll label={t.mod.bulkHint} />
            <span />
            <span>{t.mod.colResource}</span>
            <span>{t.mod.colSeller}</span>
            <span>{t.mod.colStatus}</span>
            <span className="text-right">{t.mod.colSales}</span>
            <span className="text-right">{t.mod.colRating}</span>
            <span>{t.mod.colAi}</span>
            <span />
          </div>

          {resources.length === 0 && (
            <p className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
              <Package className="h-6 w-6" aria-hidden="true" />
              {t.mod.noResources}
            </p>
          )}

          <ul className="divide-y divide-border">
            {resources.map((r) => {
              const sale = salesOf.get(r.id);
              const ai = aiOf.get(r.id);
              const canDelete = !lockedIds.has(r.id);
              return (
                <li key={r.id} className="grid grid-cols-[20px_56px_minmax(0,1fr)_32px] items-center gap-3 py-3 lg:grid-cols-[20px_64px_minmax(0,1fr)_120px_110px_96px_64px_88px_32px]">
                  <input type="checkbox" name="ids" value={r.id} aria-label={r.title} className="h-4 w-4 accent-[var(--color-text)]" />
                  <Thumb image={r.images[0]} category={r.category} className="w-14 lg:w-16" />
                  <div className="min-w-0">
                    <Link href={`/resources/${r.slug}`} className="block truncate text-sm font-semibold hover:underline">
                      {r.title}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {categoryLabel(r.category)} · {formatPrice(r.priceCents, locale)} · v{r.version}
                    </p>
                    {/* Sur téléphone : vendeur, statut et chiffres sous le titre */}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted lg:hidden">
                      <StatusBadge status={r.status} />
                      <span>{r.seller.username}</span>
                      <span>· {t.card.sales(sale?._count ?? 0)}</span>
                    </div>
                  </div>
                  <Link href={`/admin/users?id=${r.seller.id}`} className="hidden truncate text-sm hover:underline lg:block">
                    {r.seller.username}
                  </Link>
                  <div className="hidden lg:block">
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="hidden text-right text-sm lg:block">
                    <p className="font-semibold">{sale?._count ?? 0}</p>
                    <p className="text-xs text-muted">{formatAmount(sale?._sum.amountCents ?? 0, locale)}</p>
                  </div>
                  <p className="hidden items-center justify-end gap-1 text-sm lg:flex">
                    {r.ratingCount > 0 ? (
                      <>
                        <Star className="h-3.5 w-3.5 text-accent" fill="currentColor" strokeWidth={0} aria-hidden="true" />
                        {r.ratingAvg.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        <span className="text-xs text-muted">({r.ratingCount})</span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </p>
                  <div className="hidden lg:block">
                    {ai ? <AiBadge status={ai.aiStatus} match={ai.aiMatch} quality={ai.aiQuality} description={ai.aiDescription} flagged={ai.aiFlagged} failedLabel={t.ai.failed} /> : null}
                  </div>

                  <RowMenu label={`${t.dashboard.actions} : ${r.title}`}>
                    <Link role="menuitem" href={`/resources/${r.slug}`} className={menuItem}>
                      <ExternalLink className="h-4 w-4 text-muted" aria-hidden="true" />
                      {t.mod.viewPage}
                    </Link>
                    <Link role="menuitem" href={`/dashboard/resources/${r.id}/edit`} className={menuItem}>
                      <Pencil className="h-4 w-4 text-muted" aria-hidden="true" />
                      {t.mod.edit}
                    </Link>
                    {(r.status === "REJECTED" || r.status === "PENDING") && (
                      <button role="menuitem" formAction={adminApprove.bind(null, r.id)} className={menuItem}>
                        <CircleCheck className="h-4 w-4 text-ok" aria-hidden="true" />
                        {t.mod.approveLive}
                      </button>
                    )}
                    {r.status === "APPROVED" && (
                      <button role="menuitem" formAction={adminUnlist.bind(null, r.id)} className={menuItem}>
                        <EyeOff className="h-4 w-4 text-muted" aria-hidden="true" />
                        {t.admin.unlist}
                      </button>
                    )}
                    {r.status === "UNLISTED" && (
                      <button role="menuitem" formAction={adminRelist.bind(null, r.id)} className={menuItem}>
                        <Eye className="h-4 w-4 text-muted" aria-hidden="true" />
                        {t.mod.relist}
                      </button>
                    )}
                    <button role="menuitem" formAction={adminReanalyze.bind(null, r.id)} className={menuItem}>
                      <RefreshCw className="h-4 w-4 text-muted" aria-hidden="true" />
                      {t.mod.reanalyze}
                    </button>
                    <hr className="mx-1.5 my-1 border-border" />
                    {canDelete ? (
                      <ConfirmButton action={adminDelete.bind(null, r.id)} confirm={t.mod.deleteConfirm(r.title)} className={`${menuItem} text-bad hover:bg-bad-bg`}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        {t.mod.deleteForever}
                      </ConfirmButton>
                    ) : (
                      <button type="button" role="menuitem" disabled className={menuItem}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {t.mod.deleteForever}
                          <span className="mt-0.5 block text-[11.5px] font-normal">{t.mod.deleteBlocked}</span>
                        </span>
                      </button>
                    )}
                  </RowMenu>
                </li>
              );
            })}
          </ul>
        </div>
      </form>

      <div className="mt-5 flex flex-col items-center gap-3">
        <p className="text-xs text-muted">{t.mod.showingOf(resources.length, total)}</p>
        {resources.length < total && (
          <Link href={href({ limit: String(limit + PAGE) })} scroll={false} className="btn-ghost bg-card px-6">
            {t.catalog.loadMore}
          </Link>
        )}
      </div>
    </>
  );
}
