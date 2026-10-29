import Link from "next/link";
import { Ban, Search, Undo2, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatDate } from "@/lib/i18n/format";
import { banMember, releaseSellerEarnings, resumePublishing, setGlobalCooldown, setMemberCooldown, setModerator, unbanMember } from "@/app/moderation-actions";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser, siteOwnerId } from "@/lib/auth";
import { formatPauseEnd, globalCooldownHours, MAX_COOLDOWN_HOURS, publishCooldown, publishPause, PUBLISH_PAUSE_DAYS, toBrusselsInput } from "@/lib/publish-pause";
import { PublishPauseForm } from "@/components/admin/PublishPauseForm";
import { adminRemoveAvatar } from "@/app/member-actions";
import { links } from "@/lib/notifications";
import { UserAvatar } from "@/components/UserAvatar";
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
    select: { id: true, username: true, email: true, role: true, bannedAt: true, avatarUrl: true, _count: { select: { resources: true } } },
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

  // Règles de publication : réglage global, et pause / délai du membre affiché
  const [viewer, ownerId] = await Promise.all([getCurrentUser(), siteOwnerId()]);
  const isOwner = Boolean(viewer && viewer.id === ownerId);
  const [globalHours, memberPause, memberCooldown] = await Promise.all([
    globalCooldownHours(),
    member ? publishPause(member.id) : null,
    member ? publishCooldown(member.id) : null,
  ]);
  // Gains pas encore versés du membre (panneau « Débloquer et verser », propriétaire seulement)
  const pending =
    member && isOwner
      ? await db.sellerEarning.findMany({
          where: { sellerId: member.id, status: "PENDING", payoutId: null },
          orderBy: { availableAt: "asc" },
          select: { id: true, amountCents: true, availableAt: true },
        })
      : [];
  const hoursField = "h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm outline-none transition focus:border-text";

  const userHref = (userId: string) => `/admin/users?${new URLSearchParams({ ...(query && { q: query }), id: userId })}`;
  const fmt1 = (n: number) => n.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <>
      <PageTitle title={t.mod.menu.users} intro={t.mod.usersIntro} />

      {/* Délai entre deux publications pour tous les vendeurs */}
      <form action={setGlobalCooldown} className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-0 max-w-xl">
          <p className="text-sm font-semibold">{t.publishPause.globalTitle}</p>
          <p className="mt-0.5 text-xs text-muted">{t.publishPause.globalHelp}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="number" name="hours" min={0} max={MAX_COOLDOWN_HOURS} defaultValue={globalHours} aria-label={t.publishPause.globalTitle} className={hoursField} />
          <span className="text-sm text-muted">{t.publishPause.hours}</span>
          <button className="btn-ghost px-4 py-2 text-sm">{t.publishPause.save}</button>
        </div>
      </form>
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
                    <UserAvatar name={u.username} src={u.avatarUrl} size={32} />
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
              <UserAvatar name={member.username} src={member.avatarUrl} size={48} />
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-lg font-semibold">
                  <Link href={links.profile(member.username)} className="hover:underline">
                    {member.username}
                  </Link>
                  {member.bannedAt ? <Badge tone="bad">{t.mod.banned}</Badge> : <Badge tone="ok">{t.mod.active}</Badge>}
                  {member.role === "ADMIN" && <Badge tone="accent">{t.mod.admin}</Badge>}
                  {member.founderUntil && member.founderUntil > new Date() && <Badge tone="accent">{t.mod.founder}</Badge>}
                </p>
                {/* Photo inappropriée : la modération peut la retirer */}
                {member.avatarUrl && (
                  <form action={adminRemoveAvatar} className="mb-0.5">
                    <input type="hidden" name="userId" value={member.id} />
                    <button className="text-xs font-semibold text-bad hover:underline">{t.mod.removeAvatar}</button>
                  </form>
                )}
                <p className="text-sm text-muted">
                  {t.mod.memberSince(member.email, formatDate(member.createdAt, locale))}
                  {member.resources.length > 0 && ` · ${member.stripeTransfersActive ? t.mod.payoutsOn : t.mod.payoutsOff}`}
                </p>
                {/* Provenance à l'inscription */}
                {(member.signupSource || member.signupCountry) && (
                  <p className="text-sm text-muted">
                    {t.mod.signupFrom} <strong className="text-text">{member.signupSource === "direct" ? t.mod.originDirect : member.signupSource}</strong>
                    {member.signupCountry && ` · ${new Intl.DisplayNames([locale === "fr" ? "fr-FR" : "en-GB"], { type: "region" }).of(member.signupCountry)}`}
                    {member.signupReferrer && ` · ${member.signupReferrer}`}
                    {member.signupLanding && ` · ${t.mod.signupLanding(member.signupLanding)}`}
                  </p>
                )}
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
                <p className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
                  {t.mod.userResources}
                  <Link href={`/admin/resources?seller=${member.id}`} className="text-xs font-semibold text-muted hover:text-text hover:underline">
                    {t.mod.sellerResources} →
                  </Link>
                </p>
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

            {/* Publications : pause (durée, date ou jusqu'à nouvel ordre) et délai entre deux publications */}
            {member.role !== "ADMIN" && !member.bannedAt && memberCooldown && (
              <div className="mt-4 space-y-4 rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{t.publishPause.panelTitle}</p>
                  {memberPause ? (
                    <Badge tone="warn">{memberPause.indefinite ? t.publishPause.pausedIndefinite : t.publishPause.pausedUntil(formatPauseEnd(memberPause.until!, locale))}</Badge>
                  ) : (
                    <Badge tone="ok">{t.publishPause.statusFree}</Badge>
                  )}
                </div>

                {memberPause ? (
                  <form action={resumePublishing} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warn-bg px-4 py-3">
                    <input type="hidden" name="userId" value={member.id} />
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-warn">{memberPause.indefinite ? t.publishPause.pausedIndefinite : t.publishPause.pausedUntil(formatPauseEnd(memberPause.until!, locale))}</p>
                      {memberPause.reason && <p className="mt-0.5 break-words text-text/80">{t.publishPause.reasonShown(memberPause.reason)}</p>}
                    </div>
                    <button className="btn-ghost px-4 py-2 text-sm">{t.publishPause.resume}</button>
                  </form>
                ) : (
                  <PublishPauseForm userId={member.id} defaultUntil={toBrusselsInput(new Date(Date.now() + PUBLISH_PAUSE_DAYS * 24 * 3600 * 1000))} />
                )}

                <form action={setMemberCooldown} className="border-t border-border pt-4">
                  <input type="hidden" name="userId" value={member.id} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{t.publishPause.cooldownTitle}</p>
                    <span className="text-xs font-semibold text-muted">{t.publishPause.cooldownStatus(memberCooldown.hours, memberCooldown.own)}</span>
                  </div>
                  {memberCooldown.nextAt && <p className="mt-1 text-xs font-semibold text-warn">{t.publishPause.nextAt(formatPauseEnd(memberCooldown.nextAt, locale))}</p>}
                  <p className="mt-1 text-xs text-muted">{t.publishPause.cooldownHelp(globalHours)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="number" name="hours" min={0} max={MAX_COOLDOWN_HOURS} defaultValue={member.publishCooldownHours ?? ""} placeholder={String(globalHours)} aria-label={t.publishPause.cooldownTitle} className={hoursField} />
                    <span className="text-sm text-muted">{t.publishPause.hours}</span>
                    <button className="btn-ghost px-4 py-2 text-sm">{t.publishPause.save}</button>
                  </div>
                </form>
              </div>
            )}

            {/* Gains en attente : le propriétaire peut lever le délai de sécurité et verser tout de suite */}
            {pending.length > 0 && (
              <form action={releaseSellerEarnings} className="mt-4 rounded-2xl border border-border p-4">
                <input type="hidden" name="userId" value={member.id} />
                <p className="text-sm font-semibold">{t.mod.earningsTitle(formatAmount(pending.reduce((n, e) => n + e.amountCents, 0), locale))}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {pending.map((e) => (
                    <li key={e.id} className="flex items-center justify-between gap-3">
                      <span>{formatAmount(e.amountCents, locale)}</span>
                      <span className="text-xs text-muted">{e.availableAt > new Date() ? t.mod.earningsHeld(formatDate(e.availableAt, locale)) : t.mod.earningsReady}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <p className="min-w-0 max-w-xl text-xs text-muted">{t.mod.earningsText}</p>
                  <SubmitButton className="btn-ghost px-4 py-2 text-sm" pendingText={t.mod.earningsRunning}>
                    {t.mod.earningsButton}
                  </SubmitButton>
                </div>
              </form>
            )}

            {/* Rôle de modérateur : seul le propriétaire du site peut le donner ou le retirer */}
            {isOwner && member.id !== viewer!.id && !member.bannedAt && (
              <div className="mt-4 rounded-2xl border border-border p-4">
                <p className="text-sm font-semibold">{t.mod.roleTitle}</p>
                {member.id === ownerId ? (
                  <p className="mt-1 text-xs text-muted">{t.mod.roleOwner}</p>
                ) : (
                  <form action={setModerator} className="mt-1 flex flex-wrap items-end justify-between gap-3">
                    <input type="hidden" name="userId" value={member.id} />
                    <input type="hidden" name="make" value={member.role === "ADMIN" ? "0" : "1"} />
                    <p className="min-w-0 max-w-xl text-xs text-muted">{member.role === "ADMIN" ? t.mod.roleRevokeText : t.mod.roleGrantText}</p>
                    <button className="btn-ghost px-4 py-2 text-sm">{member.role === "ADMIN" ? t.mod.roleRevoke : t.mod.roleGrant(member.username)}</button>
                  </form>
                )}
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
