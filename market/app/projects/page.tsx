import Link from "next/link";
import { Briefcase, Clock, MessageSquare, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount } from "@/lib/i18n/format";
import { CATEGORIES, categoryLabel } from "@/lib/catalog";
import { UserAvatar } from "@/components/UserAvatar";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.projects.title, description: t.projects.intro };
}

// Projets sur mesure : demandes ouvertes, où les développeurs peuvent proposer leur prix (voir lib/projects.ts)
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [{ category }, user, { locale, t }] = await Promise.all([searchParams, getCurrentUser(), getDictionary()]);
  const s = t.projects;
  const filter = CATEGORIES.some((c) => c.id === category) ? category : undefined;
  const requests = await db.projectRequest.findMany({
    where: { status: "OPEN", client: { bannedAt: null }, ...(filter && { category: filter }) },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { client: { select: { username: true, avatarUrl: true } }, _count: { select: { offers: { where: { status: "PENDING" } } } } },
  });
  const when = (d: Date) => d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });

  return (
    <div className="container-q pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold">
            <Briefcase className="h-3.5 w-3.5" aria-hidden="true" /> {s.nav}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{s.title}</h1>
          <p className="mt-2 text-[15px] text-muted">{s.intro}</p>
        </div>
        <Link href={user ? "/projects/new" : "/login?next=/projects/new"} className="btn-accent rounded-xl px-5 py-3 text-sm">
          <Plus className="h-4 w-4" aria-hidden="true" /> {user ? s.newRequest : s.loginToPost}
        </Link>
      </div>

      {/* Comment ça marche */}
      <ol className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {s.how.map(([title, text], i) => (
          <li key={title} className="rounded-2xl border border-border bg-card p-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-bold">{i + 1}</span>
            <p className="mt-2 font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ol>

      {/* Catégories */}
      <nav className="mt-8 flex flex-wrap gap-1.5" aria-label={t.projects.categoryLabel}>
        {[{ id: "", label: s.all }, ...CATEGORIES].map((c) => {
          const on = (c.id || undefined) === filter;
          return (
            <Link
              key={c.id || "all"}
              href={c.id ? `/projects?category=${c.id}` : "/projects"}
              aria-current={on ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${on ? "border-text bg-text text-bg" : "border-border bg-card hover:border-border-strong"}`}
            >
              {c.label}
            </Link>
          );
        })}
      </nav>

      {requests.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border-strong bg-card px-6 py-12 text-center text-sm text-muted">{s.empty}</p>
      ) : (
        <ul className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/projects/${r.id}`} className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{r.title}</h2>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold">{s.budget(formatAmount(r.budgetCents, locale))}</span>
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{r.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="rounded-full bg-surface px-2 py-0.5 font-semibold">{categoryLabel(r.category)}</span>
                  {r.deadlineDays && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {s.deadline(r.deadlineDays)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> {s.offers(r._count.offers)}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1.5">
                    <UserAvatar name={r.client.username} src={r.client.avatarUrl} size={18} />
                    {r.client.username} · {when(r.createdAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
