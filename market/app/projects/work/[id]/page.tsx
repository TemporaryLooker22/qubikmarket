import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, Download, FileCheck2, Gavel, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatSize } from "@/lib/i18n/format";
import { links } from "@/lib/notifications";
import { stripe } from "@/lib/payments";
import { directUploads } from "@/lib/storage";
import { buyerFeeCents } from "@/lib/buyer-fee";
import { fulfillProjectSession, projectRole, releaseOverdueProjects } from "@/lib/projects";
import {
  abandonProject,
  acceptProjectDelivery,
  cancelUnpaidProject,
  openProjectDispute,
  payProject,
  requestProjectRevision,
  resolveProjectDispute,
} from "@/app/project-actions";
import { UserAvatar } from "@/components/UserAvatar";
import { ConfirmButton, DeliverForm, ProjectComposer, ProjectLive } from "@/components/projects/ProjectClient";
import { inputClass } from "@/components/edit/EditForms";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { title: true } });
  return { title: project?.title, robots: { index: false } };
}

const STEP_OF: Record<string, number> = { AWAITING_PAYMENT: 0, IN_PROGRESS: 1, DELIVERED: 2, COMPLETED: 3, DISPUTED: 2, REFUNDED: -1, CANCELED: -1 };

// Projet sur mesure en cours : étapes, actions du client, du développeur et de la modération, et conversation
export default async function ProjectWorkPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const [{ id }, { session_id }, user, { locale, t }] = await Promise.all([params, searchParams, getCurrentUser(), getDictionary()]);
  if (!user) redirect(`/login?next=/projects/work/${id}`);
  const s = t.projects;

  // Retour du paiement Stripe : on enregistre le paiement tout de suite (le webhook peut arriver après le client)
  if (session_id && stripe) {
    const session = await stripe.checkout.sessions.retrieve(session_id).catch(() => null);
    if (session?.metadata?.projectId === id) await fulfillProjectSession(session);
  }
  // Livré depuis 7 jours sans réponse : validé automatiquement (aussi fait chaque jour par la tâche Vercel)
  await releaseOverdueProjects();

  const project = await db.project.findUnique({
    where: { id },
    include: {
      client: { select: { username: true, avatarUrl: true } },
      dev: { select: { username: true, avatarUrl: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { username: true, avatarUrl: true, role: true } } } },
      _count: { select: { messages: true } },
    },
  });
  if (!project) notFound();
  const role = projectRole(project, user);
  if (!role) notFound();

  const money = (c: number) => formatAmount(c, locale);
  const when = (d: Date) => d.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const total = project.amountCents || project.priceCents + buyerFeeCents(project.priceCents);
  const fee = project.buyerFeeCents || buyerFeeCents(project.priceCents);
  const step = STEP_OF[project.status] ?? 0;
  const card = "rounded-2xl border border-border bg-card p-5";
  const st = project.status;
  const disputeForm = (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm font-semibold text-bad">{s.disputeTitle}</summary>
      <form action={openProjectDispute} className="mt-3 space-y-2">
        <input type="hidden" name="projectId" value={project.id} />
        <textarea name="reason" required minLength={10} maxLength={1000} rows={3} placeholder={s.disputePh} className={`${inputClass} h-auto py-2.5`} />
        <button className="rounded-xl bg-bad px-4 py-2 text-sm font-semibold text-white hover:opacity-90">{s.dispute}</button>
      </form>
    </details>
  );

  return (
    <div className="container-q max-w-5xl pt-8">
      <ProjectLive projectId={project.id} version={`${st}:${project._count.messages}:${project.updatedAt.getTime()}`} />
      <Link href={role === "admin" ? "/admin/projects" : "/dashboard/projects"} className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {role === "admin" ? s.adminTitle : s.projectBack}
      </Link>

      <section className={`${card} mt-3`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{project.title}</h1>
            <Link href={`/projects/${project.requestId}`} className="text-xs text-muted hover:underline">
              {s.back}
            </Link>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${st === "DISPUTED" ? "bg-bad-bg text-bad" : st === "COMPLETED" ? "bg-ok-bg text-ok" : "bg-accent-soft"}`}>{s.projectStatus[st]}</span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            [s.client, project.client],
            [s.developer, project.dev],
          ].map(([label, who]) => {
            const u = who as { username: string; avatarUrl: string | null };
            return (
              <div key={label as string}>
                <dt className="text-xs text-muted">{label as string}</dt>
                <dd>
                  <Link href={links.profile(u.username)} className="mt-0.5 inline-flex items-center gap-1.5 font-semibold hover:underline">
                    <UserAvatar name={u.username} src={u.avatarUrl} size={20} /> {u.username}
                  </Link>
                </dd>
              </div>
            );
          })}
          <div>
            <dt className="text-xs text-muted">{s.price}</dt>
            <dd className="font-extrabold">{money(project.priceCents)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{s.daysLabel}</dt>
            <dd className="font-semibold">{s.deadlineFor(project.days)}</dd>
          </div>
        </dl>
        {/* Étapes */}
        {step >= 0 && (
          <ol className="mt-5 grid grid-cols-4 gap-2">
            {s.steps.map((label, i) => (
              <li key={label} className="text-center">
                <span className={`block h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-surface"}`} />
                <span className={`mt-1.5 block text-[11px] font-semibold ${i <= step ? "text-text" : "text-muted"}`}>{label}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-ok" aria-hidden="true" /> {s.escrow}
        </p>
      </section>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* Conversation */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card lg:order-1">
          <p className="border-b border-border px-5 py-3 font-semibold">{s.threadTitle}</p>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
            {project.messages.length === 0 && <p className="text-sm text-muted">{s.threadEmpty}</p>}
            {project.messages.map((m) => {
              if (m.kind === "SYSTEM") {
                return (
                  <div key={m.id} className="text-center text-xs text-muted">
                    <p className="inline-block rounded-full bg-surface px-3 py-1 font-semibold">{s.events[m.event ?? ""] ?? m.event}</p>
                    {m.body && <p className="mx-auto mt-1 max-w-md whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>}
                    <p className="mt-0.5">{when(m.createdAt)}</p>
                  </div>
                );
              }
              const own = m.senderId === user.id;
              const isMod = m.sender?.role === "ADMIN" && m.senderId !== project.clientId && m.senderId !== project.devId;
              return (
                <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${own ? "bg-text text-bg" : isMod ? "border border-accent bg-accent-soft" : "bg-surface"}`}>
                    <p className="mb-0.5 text-[11px] font-bold opacity-70">{isMod ? s.moderation : m.sender?.username}</p>
                    {m.kind === "DELIVERY" && (
                      <div className={`mb-2 rounded-xl p-3 ${own ? "bg-bg/10" : "bg-card"}`}>
                        <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                          <FileCheck2 className="h-4 w-4" aria-hidden="true" /> {s.delivery}
                        </p>
                        <a href={`/api/projects/file/${m.id}`} className="mt-1 flex items-center gap-2 font-semibold underline underline-offset-2">
                          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="truncate">{m.fileName}</span>
                          {m.fileSize ? <span className="shrink-0 text-xs opacity-70">{formatSize(m.fileSize, locale)}</span> : null}
                        </a>
                        {m.scanVerdict === "suspicious" && <p className="mt-1 text-xs font-semibold text-warn">{s.scanWarn}</p>}
                      </div>
                    )}
                    {m.body && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>}
                    {m.offPlatform && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-warn">
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> {s.offPlatform}
                      </p>
                    )}
                    <p className="mt-1 text-right text-[10px] opacity-60">{when(m.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {st !== "CANCELED" && <ProjectComposer projectId={project.id} />}
        </section>

        {/* Actions selon le rôle et l'étape */}
        <aside className={`${card} space-y-3 text-sm lg:order-2`}>
          {st === "AWAITING_PAYMENT" && role === "client" && (
            <>
              <p>{s.awaitingClient(money(total))}</p>
              <form action={payProject}>
                <input type="hidden" name="projectId" value={project.id} />
                <button className="btn-accent h-11 w-full justify-center rounded-xl text-sm">{s.pay(money(total))}</button>
              </form>
              <p className="text-xs text-muted">{s.serviceFee(money(fee))}</p>
            </>
          )}
          {st === "AWAITING_PAYMENT" && role === "dev" && <p>{s.awaitingDev}</p>}
          {st === "AWAITING_PAYMENT" && (role === "client" || role === "dev") && (
            <form action={cancelUnpaidProject}>
              <input type="hidden" name="projectId" value={project.id} />
              <button className="text-sm font-semibold text-bad hover:underline">{s.cancel}</button>
            </form>
          )}

          {st === "IN_PROGRESS" && role === "client" && <p>{s.inProgressClient}</p>}
          {st === "IN_PROGRESS" && role === "dev" && (
            <>
              <p>{s.inProgressDev}</p>
              <DeliverForm projectId={project.id} directUpload={directUploads} />
              <form action={abandonProject}>
                <input type="hidden" name="projectId" value={project.id} />
                <ConfirmButton message={s.abandonConfirm} className="text-sm font-semibold text-bad hover:underline">
                  {s.abandon}
                </ConfirmButton>
              </form>
            </>
          )}

          {st === "DELIVERED" && role === "client" && (
            <>
              <p>{s.deliveredClient}</p>
              <form action={acceptProjectDelivery}>
                <input type="hidden" name="projectId" value={project.id} />
                <ConfirmButton message={s.acceptConfirm} className="btn-accent h-11 w-full justify-center rounded-xl text-sm">
                  <Check className="h-4 w-4" aria-hidden="true" /> {s.accept}
                </ConfirmButton>
              </form>
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">{s.revision}</summary>
                <form action={requestProjectRevision} className="mt-3 space-y-2">
                  <input type="hidden" name="projectId" value={project.id} />
                  <textarea name="note" required maxLength={2000} rows={3} placeholder={s.revisionPh} className={`${inputClass} h-auto py-2.5`} />
                  <button className="btn-ghost px-4 py-2 text-sm">{s.revision}</button>
                </form>
              </details>
            </>
          )}
          {st === "DELIVERED" && role === "dev" && <p>{s.deliveredDev}</p>}
          {st === "DELIVERED" && project.autoReleaseAt && <p className="text-xs text-muted">{s.autoRelease(when(project.autoReleaseAt))}</p>}
          {(st === "IN_PROGRESS" || st === "DELIVERED") && (role === "client" || role === "dev") && disputeForm}

          {st === "COMPLETED" && (
            <>
              <p className="font-semibold text-ok">{role === "dev" ? s.completedDev : s.completedClient}</p>
              {role === "client" && (
                <Link href={links.profile(project.dev.username, "SELLER")} className="text-sm font-semibold hover:underline">
                  {s.reviewHint} →
                </Link>
              )}
            </>
          )}
          {st === "REFUNDED" && <p>{s.refunded}</p>}
          {st === "CANCELED" && <p>{s.canceled}</p>}

          {st === "DISPUTED" && (
            <>
              <p className="font-semibold text-bad">{s.disputed}</p>
              {project.disputeReason && <p className="whitespace-pre-wrap text-xs text-muted [overflow-wrap:anywhere]">{s.disputeReason(project.disputeReason)}</p>}
              {role === "admin" && (
                <form action={resolveProjectDispute} className="space-y-2 rounded-xl border border-border p-3">
                  <input type="hidden" name="projectId" value={project.id} />
                  <p className="inline-flex items-center gap-1.5 font-semibold">
                    <Gavel className="h-4 w-4" aria-hidden="true" /> {s.resolveTitle}
                  </p>
                  <textarea name="note" maxLength={500} rows={2} placeholder={s.resolveNote} className={`${inputClass} h-auto py-2.5`} />
                  <div className="flex flex-wrap gap-2">
                    <button name="decision" value="release" className="btn-accent rounded-xl px-4 py-2 text-sm">{s.release}</button>
                    <button name="decision" value="refund" className="rounded-xl bg-bad px-4 py-2 text-sm font-semibold text-white hover:opacity-90">{s.refund}</button>
                  </div>
                </form>
              )}
            </>
          )}

          {project.paidAt && (
            <p className="border-t border-border pt-3 text-xs text-muted">
              {s.totalPaid} : <strong className="text-text">{money(total)}</strong> · {s.serviceFee(money(fee))}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
