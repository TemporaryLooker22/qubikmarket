import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Briefcase, CircleCheck, Clock, Hourglass, Search, Wallet, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser, siteOwnerId } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount } from "@/lib/i18n/format";
import { holdEarnings, payEarnings, releaseDeliveredProject, releaseEarnings } from "@/app/earnings-actions";
import { projectLinks } from "@/lib/projects";
import { links } from "@/lib/notifications";
import { SubmitButton } from "@/components/SubmitButton";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge, PageTitle, Panel, Stat } from "@/components/admin/AdminUi";

// Modération → Revenus (propriétaire du site seulement) : tout l'argent d'un vendeur
// (gains par vente ou projet, délais de sécurité, versements Stripe) et les actions pour le gérer.
export default async function AdminEarningsPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string; msg?: string; info?: string }> }) {
  const [{ q = "", id, msg, info }, { locale, t }, viewer, ownerId] = await Promise.all([searchParams, getDictionary(), getCurrentUser(), siteOwnerId()]);
  if (!viewer || viewer.id !== ownerId) notFound();
  const e = t.mod.earn;
  const query = q.trim();
  const now = new Date();
  const intl = locale === "fr" ? "fr-FR" : "en-GB";
  const when = (d: Date) => d.toLocaleString(intl, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const money = (cents: number) => formatAmount(cents, locale);

  // Colonne de gauche : recherche, ou par défaut les vendeurs qui ont de l'argent en attente
  const [pendingBySeller, deliveredByDev] = await Promise.all([
    db.sellerEarning.groupBy({ by: ["sellerId"], where: { status: "PENDING" }, _sum: { amountCents: true } }),
    db.project.groupBy({ by: ["devId"], where: { status: "DELIVERED" }, _count: true }),
  ]);
  const waiting = new Map<string, { cents: number; projects: number }>();
  for (const g of pendingBySeller) waiting.set(g.sellerId, { cents: g._sum.amountCents ?? 0, projects: 0 });
  for (const g of deliveredByDev) waiting.set(g.devId, { cents: waiting.get(g.devId)?.cents ?? 0, projects: g._count });
  const sellers = await db.user.findMany({
    where: query ? { OR: [{ username: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }] } : { id: { in: [...waiting.keys()] } },
    orderBy: { username: "asc" },
    take: 50,
    select: { id: true, username: true, avatarUrl: true },
  });
  const totalWaiting = [...waiting.values()].reduce((n, w) => n + w.cents, 0);

  const seller = id
    ? await db.user.findUnique({ where: { id }, select: { id: true, username: true, email: true, avatarUrl: true, stripeAccountId: true, stripeTransfersActive: true } })
    : null;

  const [earnings, payouts, projects] = seller
    ? await Promise.all([
        db.sellerEarning.findMany({
          where: { sellerId: seller.id },
          orderBy: { createdAt: "desc" },
          take: 300,
          select: {
            id: true,
            amountCents: true,
            grossCents: true,
            feeCents: true,
            feePercent: true,
            status: true,
            availableAt: true,
            payoutId: true,
            createdAt: true,
            purchase: { select: { user: { select: { username: true } }, resource: { select: { title: true, slug: true } } } },
            project: { select: { id: true, title: true, client: { select: { username: true } } } },
            reverses: { select: { purchase: { select: { resource: { select: { title: true } } } }, project: { select: { title: true } } } },
          },
        }),
        db.sellerPayout.findMany({ where: { sellerId: seller.id }, orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { earnings: true } } } }),
        db.project.findMany({
          where: { devId: seller.id, status: { in: ["IN_PROGRESS", "DELIVERED", "DISPUTED"] } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, status: true, amountCents: true, buyerFeeCents: true, deliveredAt: true, autoReleaseAt: true, client: { select: { username: true } } },
        }),
      ])
    : [[], [], []];

  // Soldes du vendeur
  const sum = (list: typeof earnings) => list.reduce((n, x) => n + x.amountCents, 0);
  const pending = earnings.filter((x) => x.status === "PENDING");
  const held = pending.filter((x) => !x.payoutId && x.availableAt > now);
  const available = pending.filter((x) => !x.payoutId && x.availableAt <= now);
  const processing = pending.filter((x) => x.payoutId);
  const paid = earnings.filter((x) => x.status === "PAID");
  const canceled = earnings.filter((x) => x.status === "CANCELED");
  const earned = earnings.filter((x) => x.status !== "CANCELED" && x.amountCents > 0);

  const statusOf = (x: (typeof earnings)[number]) => {
    if (x.status === "CANCELED") return <Badge tone="off">{e.stCanceled}</Badge>;
    if (x.status === "PAID") return <Badge tone="ok">{e.stPaid}</Badge>;
    if (x.payoutId) return <Badge tone="accent">{e.stProcessing}</Badge>;
    if (x.availableAt > now) return <Badge tone="warn">{e.stHeld(when(x.availableAt))}</Badge>;
    return <Badge tone="accent">{e.stAvailable}</Badge>;
  };
  const sourceOf = (x: (typeof earnings)[number]) => {
    if (x.purchase) return { label: x.purchase.resource.title, sub: e.srcSale(x.purchase.user.username), href: `/resources/${x.purchase.resource.slug}` };
    if (x.project) return { label: x.project.title, sub: e.srcProject(x.project.client.username), href: projectLinks.work(x.project.id) };
    if (x.reverses) return { label: e.srcReversal, sub: x.reverses.purchase?.resource.title ?? x.reverses.project?.title ?? "", href: null };
    return { label: e.srcOther, sub: "", href: null };
  };

  const messages: Record<string, { tone: string; text: string }> = {
    released: { tone: "bg-ok-bg text-ok", text: e.msgReleased(Number(info ?? 0)) },
    held: { tone: "bg-warn-bg text-warn", text: e.msgHeld(Number(info ?? 0)) },
    paid: { tone: "bg-ok-bg text-ok", text: e.msgPaid(info ?? "") },
    notPaid: { tone: "bg-bad-bg text-bad", text: e.msgNotPaid(info ?? "") },
    projectDone: { tone: "bg-ok-bg text-ok", text: e.msgProjectDone },
    projectNo: { tone: "bg-bad-bg text-bad", text: e.msgProjectNo },
  };
  const flash = msg ? messages[msg] : null;
  const href = (sellerId: string) => `/admin/earnings?${new URLSearchParams({ ...(query && { q: query }), id: sellerId })}`;
  const stripeBase = "https://dashboard.stripe.com";
  const small = "whitespace-nowrap rounded-lg border border-border px-2.5 py-1 text-xs font-semibold transition hover:border-text disabled:opacity-50";

  return (
    <>
      <PageTitle title={e.title} intro={e.intro} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Vendeurs */}
        <div className="rounded-2xl border border-border bg-card p-2">
          <form action="/admin/earnings" className="p-1.5">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 transition focus-within:border-text">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <span className="sr-only">{t.mod.searchPh}</span>
              <input name="q" type="search" defaultValue={query} placeholder={t.mod.searchPh} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
          </form>
          <p className="px-2.5 pb-1 pt-2 text-xs font-semibold text-muted">{query ? e.results : e.waitingList(money(totalWaiting))}</p>
          {sellers.length === 0 ? (
            <p className="p-3 text-sm text-muted">{query ? t.mod.noUsers : e.noneWaiting}</p>
          ) : (
            <ul className="space-y-0.5">
              {sellers.map((u) => {
                const w = waiting.get(u.id);
                return (
                  <li key={u.id}>
                    <Link href={href(u.id)} scroll={false} className={`flex items-center gap-2.5 rounded-xl p-2 transition ${u.id === seller?.id ? "bg-accent-soft" : "hover:bg-bg"}`}>
                      <UserAvatar name={u.username} src={u.avatarUrl} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{u.username}</p>
                        {w && (
                          <p className="truncate text-xs text-muted">
                            {w.cents !== 0 && e.waitingAmount(money(w.cents))}
                            {w.cents !== 0 && w.projects > 0 && " · "}
                            {w.projects > 0 && e.waitingProjects(w.projects)}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Fiche du vendeur */}
        {seller ? (
          <div className="min-w-0 space-y-4">
            {flash && <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${flash.tone}`}>{flash.text}</p>}

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-5">
              <UserAvatar name={seller.username} src={seller.avatarUrl} size={48} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-lg font-semibold">
                  <Link href={links.profile(seller.username)} className="hover:underline">
                    {seller.username}
                  </Link>
                  {seller.stripeTransfersActive ? <Badge tone="ok">{e.stripeOn}</Badge> : seller.stripeAccountId ? <Badge tone="warn">{e.stripePending}</Badge> : <Badge tone="bad">{e.stripeNone}</Badge>}
                </p>
                <p className="truncate text-sm text-muted">{seller.email}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-semibold">
                <Link href={`/admin/users?id=${seller.id}`} className="hover:underline">
                  {e.memberCard} →
                </Link>
                {seller.stripeAccountId && (
                  <a href={`${stripeBase}/connect/accounts/${seller.stripeAccountId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                    {e.stripeAccount}
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat dark icon={Wallet} label={e.statEarned} value={money(sum(earned))} note={e.statEarnedNote(earned.length)} />
              <Stat icon={Hourglass} label={e.statHeld} value={money(sum(held))} note={e.count(held.length)} />
              <Stat icon={Clock} label={e.statAvailable} value={money(sum(available))} note={processing.length ? e.statProcessing(money(sum(processing))) : e.count(available.length)} />
              <Stat icon={CircleCheck} label={e.statPaid} value={money(sum(paid))} note={e.count(paid.length)} />
              <Stat icon={XCircle} label={e.statCanceled} value={money(sum(canceled))} note={e.count(canceled.length)} />
            </div>

            {/* Actions sur tout ce qui est en attente */}
            {held.length + available.length > 0 && (
              <Panel title={e.bulkTitle}>
                <p className="mb-3 text-xs text-muted">{e.bulkText}</p>
                <div className="flex flex-wrap gap-2">
                  <form action={payEarnings}>
                    <input type="hidden" name="sellerId" value={seller.id} />
                    <SubmitButton className="btn-primary px-4 py-2 text-sm" pendingText={e.paying}>
                      {e.payAll(money(sum(held) + sum(available)))}
                    </SubmitButton>
                  </form>
                  {held.length > 0 && (
                    <form action={releaseEarnings}>
                      <input type="hidden" name="sellerId" value={seller.id} />
                      <SubmitButton className="btn-ghost px-4 py-2 text-sm">{e.releaseAll(held.length)}</SubmitButton>
                    </form>
                  )}
                  {available.length > 0 && (
                    <form action={holdEarnings}>
                      <input type="hidden" name="sellerId" value={seller.id} />
                      <SubmitButton className="btn-ghost px-4 py-2 text-sm">{e.holdAll}</SubmitButton>
                    </form>
                  )}
                </div>
              </Panel>
            )}

            {/* Projets sur mesure pas encore validés : pas encore de gain tant que le client n'a pas validé */}
            {projects.length > 0 && (
              <Panel title={e.projectsTitle} aside={<span className="text-xs text-muted">{e.projectsNote}</span>}>
                <ul className="divide-y divide-border">
                  {projects.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Briefcase className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <Link href={projectLinks.work(p.id)} className="text-sm font-semibold hover:underline">
                          {p.title}
                        </Link>
                        <p className="text-xs text-muted">
                          {e.projectClient(p.client.username, money(p.amountCents - p.buyerFeeCents))}
                          {p.status === "DELIVERED" && p.autoReleaseAt && ` · ${e.projectAuto(when(p.autoReleaseAt))}`}
                        </p>
                      </div>
                      <Badge tone={p.status === "DISPUTED" ? "bad" : p.status === "DELIVERED" ? "warn" : "off"}>{e.projectStatus[p.status] ?? p.status}</Badge>
                      {p.status === "DELIVERED" ? (
                        <form action={releaseDeliveredProject}>
                          <input type="hidden" name="sellerId" value={seller.id} />
                          <input type="hidden" name="projectId" value={p.id} />
                          <SubmitButton className={small}>{e.projectRelease}</SubmitButton>
                        </form>
                      ) : p.status === "DISPUTED" ? (
                        <Link href={projectLinks.admin} className="text-xs font-semibold hover:underline">
                          {e.projectDispute} →
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {/* Chaque gain, avec ses actions */}
            <Panel title={e.listTitle} aside={<span className="text-xs text-muted">{e.listNote}</span>}>
              {earnings.length === 0 ? (
                <p className="py-2 text-sm text-muted">{e.listEmpty}</p>
              ) : (
                <div className="-mx-5 overflow-x-auto px-5">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted">
                        <th className="py-2 pr-3 font-semibold">{e.colDate}</th>
                        <th className="py-2 pr-3 font-semibold">{e.colSource}</th>
                        <th className="py-2 pr-3 text-right font-semibold">{e.colGross}</th>
                        <th className="py-2 pr-3 text-right font-semibold">{e.colFee}</th>
                        <th className="py-2 pr-3 text-right font-semibold">{e.colNet}</th>
                        <th className="py-2 pr-3 font-semibold">{e.colStatus}</th>
                        <th className="py-2 text-right font-semibold">{e.colActions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {earnings.map((x) => {
                        const src = sourceOf(x);
                        const open = x.status === "PENDING" && !x.payoutId;
                        return (
                          <tr key={x.id} className="align-middle">
                            <td className="whitespace-nowrap py-2.5 pr-3 text-xs text-muted">{when(x.createdAt)}</td>
                            <td className="max-w-64 py-2.5 pr-3">
                              {src.href ? (
                                <Link href={src.href} className="block truncate font-semibold hover:underline">
                                  {src.label}
                                </Link>
                              ) : (
                                <span className="block truncate font-semibold">{src.label}</span>
                              )}
                              {src.sub && <span className="block truncate text-xs text-muted">{src.sub}</span>}
                            </td>
                            <td className="whitespace-nowrap py-2.5 pr-3 text-right text-muted">{x.grossCents ? money(x.grossCents) : "—"}</td>
                            <td className="whitespace-nowrap py-2.5 pr-3 text-right text-muted">{x.feeCents ? `${money(x.feeCents)} (${x.feePercent} %)` : "—"}</td>
                            <td className={`whitespace-nowrap py-2.5 pr-3 text-right font-semibold ${x.amountCents < 0 ? "text-bad" : ""}`}>{money(x.amountCents)}</td>
                            <td className="py-2.5 pr-3">{statusOf(x)}</td>
                            <td className="py-2.5">
                              {open && x.amountCents > 0 && (
                                <div className="flex justify-end gap-1.5">
                                  <form action={payEarnings}>
                                    <input type="hidden" name="sellerId" value={seller.id} />
                                    <input type="hidden" name="earningId" value={x.id} />
                                    <SubmitButton className={small} pendingText={e.paying}>
                                      {e.payOne}
                                    </SubmitButton>
                                  </form>
                                  <form action={x.availableAt > now ? releaseEarnings : holdEarnings}>
                                    <input type="hidden" name="sellerId" value={seller.id} />
                                    <input type="hidden" name="earningId" value={x.id} />
                                    <SubmitButton className={small}>{x.availableAt > now ? e.releaseOne : e.holdOne}</SubmitButton>
                                  </form>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {/* Versements Stripe */}
            <Panel title={e.payoutsTitle}>
              {payouts.length === 0 ? (
                <p className="py-2 text-sm text-muted">{e.payoutsEmpty}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {payouts.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-sm">
                      <span className="w-40 shrink-0 text-xs text-muted">{when(p.createdAt)}</span>
                      <span className="font-semibold">{money(p.amountCents)}</span>
                      <span className="text-xs text-muted">{e.count(p._count.earnings)}</span>
                      <Badge tone={p.status === "PAID" ? "ok" : p.status === "FAILED" ? "bad" : "accent"}>{e.payoutStatus[p.status] ?? p.status}</Badge>
                      {p.failureReason && <span className="min-w-0 basis-full truncate text-xs text-bad">{p.failureReason}</span>}
                      {p.transferId && (
                        <a href={`${stripeBase}/connect/transfers/${p.transferId}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold hover:underline">
                          {e.seeStripe}
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-card px-6 py-16 text-center text-sm text-muted">
            <Wallet className="mb-2 h-6 w-6" aria-hidden="true" />
            {e.pick}
          </div>
        )}
      </div>
    </>
  );
}
