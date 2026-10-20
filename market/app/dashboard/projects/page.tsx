import Link from "next/link";
import { ArrowRight, Briefcase, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount } from "@/lib/i18n/format";
import { releaseOverdueProjects } from "@/lib/projects";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.projects.dashTitle };
}

// Mon espace → Mes projets : mes demandes, mes offres, et les projets où je suis client ou développeur
export default async function DashboardProjectsPage() {
  const user = await requireUser("/dashboard/projects");
  const { locale, t } = await getDictionary();
  const s = t.projects;
  await releaseOverdueProjects();
  const [requests, offers, projects] = await Promise.all([
    db.projectRequest.findMany({ where: { clientId: user.id }, orderBy: { createdAt: "desc" }, take: 30, include: { _count: { select: { offers: { where: { status: "PENDING" } } } } } }),
    db.projectOffer.findMany({ where: { devId: user.id }, orderBy: { updatedAt: "desc" }, take: 30, include: { request: { select: { id: true, title: true, status: true } } } }),
    db.project.findMany({
      where: { OR: [{ clientId: user.id }, { devId: user.id }], status: { not: "CANCELED" } },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: { client: { select: { username: true } }, dev: { select: { username: true } } },
    }),
  ]);
  const money = (c: number) => formatAmount(c, locale);
  const card = "rounded-2xl border border-border bg-card p-5";
  const row = "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface";
  const badge = (status: string) =>
    `shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${status === "DISPUTED" ? "bg-bad-bg text-bad" : status === "COMPLETED" ? "bg-ok-bg text-ok" : "bg-surface text-muted"}`;
  const asClient = projects.filter((p) => p.clientId === user.id);
  const asDev = projects.filter((p) => p.devId === user.id);

  const projectList = (list: typeof projects, other: "client" | "dev") =>
    list.length > 0 && (
      <ul className="mt-2 space-y-0.5">
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/projects/work/${p.id}`} className={row}>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{p.title}</span>
                <span className="text-xs text-muted">
                  {other === "dev" ? `${s.developer} : ${p.dev.username}` : `${s.client} : ${p.client.username}`} · {money(p.priceCents)}
                </span>
              </span>
              <span className={badge(p.status)}>{s.projectStatus[p.status]}</span>
            </Link>
          </li>
        ))}
      </ul>
    );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{s.dashTitle}</h1>
          <p className="mt-1 text-sm text-muted">{s.dashIntro}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/projects" className="btn-ghost px-4 py-2 text-sm">
            <Briefcase className="h-4 w-4" aria-hidden="true" /> {s.browse}
          </Link>
          <Link href="/projects/new" className="btn-accent rounded-xl px-4 py-2 text-sm">
            <Plus className="h-4 w-4" aria-hidden="true" /> {s.newRequest}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <section className={card}>
          <h2 className="font-semibold">{s.asClient}</h2>
          {projectList(asClient, "dev")}
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">{s.myRequests}</p>
          {requests.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{s.noneClient}</p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/projects/${r.id}`} className={row}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{r.title}</span>
                      <span className="text-xs text-muted">{s.offers(r._count.offers)}</span>
                    </span>
                    <span className={badge(r.status)}>{s.status[r.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold">{s.asDev}</h2>
          {projectList(asDev, "client")}
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">{s.myOffers}</p>
          {offers.length === 0 ? (
            <p className="mt-2 text-sm text-muted">
              {s.noneDev}{" "}
              <Link href="/projects" className="font-semibold text-text hover:underline">
                {s.browse} <ArrowRight className="inline h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </p>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {offers.map((o) => (
                <li key={o.id}>
                  <Link href={`/projects/${o.request.id}`} className={row}>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{o.request.title}</span>
                      <span className="text-xs text-muted">
                        {money(o.priceCents)} · {s.days(o.days)}
                      </span>
                    </span>
                    <span className={badge(o.status)}>{s.offerStatus[o.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
