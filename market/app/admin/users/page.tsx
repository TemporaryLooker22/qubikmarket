import Link from "next/link";
import { Ban, Search, Undo2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatDate } from "@/lib/i18n/format";
import { banMember, unbanMember } from "@/app/moderation-actions";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge, PageTitle, Stat } from "@/components/admin/AdminUi";

// Modération → Utilisateurs : recherche d'un membre, sa fiche (ressources, ventes, achats, avis) et bannissement
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const [{ q = "", id }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);
  const query = q.trim();

  const users = await db.user.findMany({
    where: query ? { OR: [{ username: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, username: true, email: true, role: true, bannedAt: true, _count: { select: { resources: true } } },
  });

  const member = id
    ? await db.user.findUnique({
        where: { id },
        include: { resources: { orderBy: { createdAt: "desc" }, select: { id: true, slug: true, title: true, status: true } } },
      })
    : null;
  const stats = member
    ? await Promise.all([
        db.purchase.count({ where: { status: "PAID", resource: { sellerId: member.id } } }),
        db.sellerEarning.aggregate({ where: { sellerId: member.id, purchaseId: { not: null }, status: { not: "CANCELED" } }, _sum: { amountCents: true } }),
        db.purchase.count({ where: { userId: member.id, status: { in: ["PAID", "REFUNDED", "DISPUTED"] } } }),
        db.purchase.count({ where: { userId: member.id, status: "REFUNDED" } }),
        db.review.aggregate({ where: { userId: member.id }, _count: true, _avg: { rating: true } }),
      ])
    : null;

  const userHref = (userId: string) => `/admin/users?${new URLSearchParams({ ...(query && { q: query }), id: userId })}`;
  const fmt1 = (n: number) => n.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <>
      <PageTitle title={t.mod.menu.users} intro={t.mod.usersIntro} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        {/* Recherche et liste */}
        <div className="rounded-2xl border border-border bg-card p-2">
          <form action="/admin/users" className="p-1.5">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 transition focus-within:border-text">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="sr-only">{t.mod.searchPh}</span>
              <input name="q" type="search" defaultValue={query} placeholder={t.mod.searchPh} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
          </form>
          {users.length === 0 ? (
            <p className="p-3 text-sm text-muted">{t.mod.noUsers}</p>
          ) : (
            <ul className="space-y-0.5">
              {users.map((u) => (
                <li key={u.id}>
                  <Link
                    href={userHref(u.id)}
                    scroll={false}
                    className={`flex items-center gap-2.5 rounded-xl p-2 transition ${u.id === member?.id ? "bg-accent-soft" : "hover:bg-bg"}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-text text-[13px] font-bold uppercase text-bg">{u.username.slice(0, 1)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        <span className="truncate">{u.username}</span>
                        {u.bannedAt && <Badge tone="bad">{t.mod.banned}</Badge>}
                        {u.role === "ADMIN" && <Badge tone="accent">{t.mod.admin}</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {u.email}
                        {u._count.resources > 0 && ` · ${t.mod.statResources.toLowerCase()} ${u._count.resources}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Fiche du membre */}
        {member && stats ? (
          <div className="min-w-0 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-text text-lg font-bold uppercase text-bg">{member.username.slice(0, 1)}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-lg font-semibold">
                  {member.username}
                  {member.bannedAt ? <Badge tone="bad">{t.mod.banned}</Badge> : <Badge tone="ok">{t.mod.active}</Badge>}
                  {member.role === "ADMIN" && <Badge tone="accent">{t.mod.admin}</Badge>}
                  {member.founderUntil && member.founderUntil > new Date() && <Badge tone="accent">{t.mod.founder}</Badge>}
                </p>
                <p className="text-sm text-muted">
                  {t.mod.memberSince(member.email, formatDate(member.createdAt, locale))}
                  {member.resources.length > 0 && ` · ${member.stripeTransfersActive ? t.mod.payoutsOn : t.mod.payoutsOff}`}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label={t.mod.statResources} value={String(member.resources.length)} note={t.mod.statResourcesNote(member.resources.filter((r) => r.status === "APPROVED").length)} />
              <Stat label={t.mod.statSales} value={String(stats[0])} note={t.mod.statSalesNote(formatAmount(stats[1]._sum.amountCents ?? 0, locale))} />
              <Stat label={t.mod.statPurchases} value={String(stats[2])} note={t.mod.statPurchasesNote(stats[3])} />
              <Stat label={t.mod.statReviews} value={String(stats[4]._count)} note={t.mod.statReviewsNote(stats[4]._avg.rating ? fmt1(stats[4]._avg.rating) : null)} />
            </div>

            {member.resources.length > 0 && (
              <div className="mt-4 rounded-xl bg-bg p-4">
                <p className="mb-2 text-sm font-semibold">{t.mod.userResources}</p>
                <ul className="space-y-1.5">
                  {member.resources.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link href={`/resources/${r.slug}`} className="truncate hover:underline">
                        {r.title}
                      </Link>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bannir / débannir */}
            <div className="mt-4 rounded-2xl border border-border p-4">
              {member.bannedAt ? (
                <form action={unbanMember}>
                  <input type="hidden" name="userId" value={member.id} />
                  <p className="text-sm font-semibold text-bad">{t.mod.bannedOn(formatDate(member.bannedAt, locale))}</p>
                  {member.banReason && <p className="mt-1 text-sm">« {member.banReason} »</p>}
                  <p className="mt-2 text-xs text-muted">{t.mod.unbanText}</p>
                  <button className="btn-ghost mt-3 px-4 py-2 text-sm">
                    <Undo2 className="h-4 w-4" aria-hidden="true" />
                    {t.mod.unban}
                  </button>
                </form>
              ) : member.role === "ADMIN" ? (
                <p className="text-sm text-muted">{t.mod.cantBan}</p>
              ) : (
                <form action={banMember}>
                  <input type="hidden" name="userId" value={member.id} />
                  <p className="text-sm font-semibold">{t.mod.banTitle}</p>
                  <p className="mt-1 text-xs text-muted">{t.mod.banText}</p>
                  <textarea
                    name="reason"
                    rows={2}
                    maxLength={500}
                    placeholder={t.mod.banPh}
                    className="mt-3 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-text"
                  />
                  <div className="mt-2 flex justify-end">
                    <button className="inline-flex items-center gap-1.5 rounded-xl bg-bad px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">
                      <Ban className="h-4 w-4" aria-hidden="true" />
                      {t.mod.ban(member.username)}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-card px-6 py-16 text-center text-sm text-muted">
            <Users className="mb-2 h-6 w-6" aria-hidden="true" />
            {t.mod.pickUser}
          </div>
        )}
      </div>
    </>
  );
}
