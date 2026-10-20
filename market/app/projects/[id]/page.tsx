import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Clock, Lock } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatDate } from "@/lib/i18n/format";
import { categoryLabel } from "@/lib/catalog";
import { links } from "@/lib/notifications";
import { PROJECT_FEE_PERCENT } from "@/lib/projects";
import { acceptProjectOffer, cancelProjectRequest, withdrawProjectOffer } from "@/app/project-actions";
import { UserAvatar } from "@/components/UserAvatar";
import { OfferForm } from "@/components/projects/OfferForm";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await db.projectRequest.findUnique({ where: { id }, select: { title: true, description: true } });
  return request ? { title: request.title, description: request.description.slice(0, 160) } : {};
}

// Une demande de projet : le client voit les offres et choisit, les développeurs proposent leur prix
export default async function ProjectRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, { locale, t }] = await Promise.all([params, getCurrentUser(), getDictionary()]);
  const s = t.projects;
  const request = await db.projectRequest.findUnique({
    where: { id },
    include: {
      client: { select: { username: true, avatarUrl: true, bannedAt: true } },
      offers: { orderBy: { createdAt: "asc" }, include: { dev: { select: { username: true, avatarUrl: true } } } },
      projects: { where: { status: { not: "CANCELED" } }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, clientId: true, devId: true } },
    },
  });
  if (!request || (request.client.bannedAt && user?.role !== "ADMIN")) notFound();

  const isClient = user?.id === request.clientId;
  const isAdmin = user?.role === "ADMIN";
  const mine = user ? request.offers.find((o) => o.devId === user.id) : undefined;
  const pending = request.offers.filter((o) => o.status === "PENDING");
  const project = request.projects[0];
  const inProject = project && user && (project.clientId === user.id || project.devId === user.id || isAdmin);
  const money = (c: number) => formatAmount(c, locale);
  const card = "rounded-2xl border border-border bg-card p-5";

  return (
    <div className="container-q max-w-4xl pt-8">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {s.back}
      </Link>

      <section className={`${card} mt-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{request.title}</h1>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold">{s.status[request.status]}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <Link href={links.profile(request.client.username)} className="inline-flex items-center gap-1.5 font-semibold text-text hover:underline">
            <UserAvatar name={request.client.username} src={request.client.avatarUrl} size={22} /> {request.client.username}
          </Link>
          <span>{s.postedOn(formatDate(request.createdAt, locale))}</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">{categoryLabel(request.category)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-bold">{s.budget(money(request.budgetCents))}</span>
          {request.deadlineDays && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2 text-sm font-semibold">
              <Clock className="h-4 w-4" aria-hidden="true" /> {s.deadline(request.deadlineDays)}
            </span>
          )}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed [overflow-wrap:anywhere]">{request.description}</p>
        {isClient && request.status === "OPEN" && (
          <form action={cancelProjectRequest} className="mt-4">
            <input type="hidden" name="requestId" value={request.id} />
            <button className="text-sm font-semibold text-bad hover:underline">{s.cancelRequest}</button>
          </form>
        )}
      </section>

      {/* Projet en cours : lien pour les deux parties et la modération */}
      {project && inProject && (
        <Link href={`/projects/work/${project.id}`} className={`${card} mt-4 flex items-center justify-between gap-3 font-semibold transition hover:border-border-strong`}>
          {s.assigned}
          <span className="inline-flex shrink-0 items-center gap-1 text-sm">
            {s.openProject} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      )}

      {/* Client (et modération) : les offres reçues */}
      {(isClient || isAdmin) && (
        <section className={`${card} mt-4`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{s.offersTitle(request.offers.length)}</h2>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" /> {s.pricesPrivate}
            </span>
          </div>
          {request.offers.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{s.noOffers}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {request.offers.map((o) => (
                <li key={o.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link href={links.profile(o.dev.username)} className="inline-flex items-center gap-2 font-semibold hover:underline">
                      <UserAvatar name={o.dev.username} src={o.dev.avatarUrl} size={28} /> {o.dev.username}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-extrabold">{money(o.priceCents)}</span>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">{s.days(o.days)}</span>
                      {o.status !== "PENDING" && <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted">{s.offerStatus[o.status]}</span>}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{o.message}</p>
                  {isClient && request.status === "OPEN" && o.status === "PENDING" && (
                    <form action={acceptProjectOffer} className="mt-3 flex flex-wrap items-center gap-3">
                      <input type="hidden" name="offerId" value={o.id} />
                      <button className="btn-accent rounded-xl px-4 py-2 text-sm">
                        <Check className="h-4 w-4" aria-hidden="true" /> {s.choose}
                      </button>
                      <span className="text-xs text-muted">{s.chooseNote}</span>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Développeurs : faire ou modifier son offre */}
      {!isClient && (
        <section className={`${card} mt-4`}>
          <h2 className="text-lg font-semibold">{mine ? s.yourOffer : s.makeOffer}</h2>
          <p className="mt-1 text-sm text-muted">{s.offers(pending.length)}</p>
          <div className="mt-4">
            {!user ? (
              <Link href={`/login?next=/projects/${request.id}`} className="btn-accent rounded-xl px-5 py-2.5 text-sm">
                {s.loginToOffer}
              </Link>
            ) : request.status !== "OPEN" ? (
              <p className="text-sm text-muted">{mine ? `${s.offerStatus[mine.status]} · ${money(mine.priceCents)}` : s.closedRequest}</p>
            ) : (
              <>
                {mine && mine.status !== "WITHDRAWN" && (
                  <p className="mb-3 text-sm font-semibold">
                    {s.offerStatus[mine.status]} · {money(mine.priceCents)} · {s.days(mine.days)}
                  </p>
                )}
                <OfferForm
                  requestId={request.id}
                  feePercent={PROJECT_FEE_PERCENT}
                  initial={mine && mine.status === "PENDING" ? { price: mine.priceCents / 100, days: mine.days, message: mine.message } : undefined}
                />
                {mine?.status === "PENDING" && (
                  <form action={withdrawProjectOffer} className="mt-3">
                    <input type="hidden" name="offerId" value={mine.id} />
                    <button className="text-sm font-semibold text-bad hover:underline">{s.withdraw}</button>
                  </form>
                )}
              </>
            )}
          </div>
        </section>
      )}
      {isClient && request.status === "OPEN" && <p className="mt-3 text-xs text-muted">{s.ownRequestNote}</p>}
    </div>
  );
}
