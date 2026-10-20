import Link from "next/link";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount } from "@/lib/i18n/format";
import { Badge, PageTitle, Panel } from "@/components/admin/AdminUi";

// Modération → Projets : litiges à trancher, puis tous les projets sur mesure (voir lib/projects.ts)
export default async function AdminProjectsPage() {
  const { locale, t } = await getDictionary();
  const s = t.projects;
  const include = { client: { select: { username: true } }, dev: { select: { username: true } } } as const;
  const [disputes, all] = await Promise.all([
    db.project.findMany({ where: { status: "DISPUTED" }, orderBy: { disputedAt: "asc" }, include }),
    db.project.findMany({ where: { status: { not: "DISPUTED" } }, orderBy: { updatedAt: "desc" }, take: 100, include }),
  ]);
  const when = (d: Date) => d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short" });
  const tone = (status: string) => (status === "COMPLETED" ? "ok" : status === "REFUNDED" || status === "CANCELED" ? "off" : status === "DISPUTED" ? "bad" : "warn");

  const list = (rows: typeof all) => (
    <ul className="divide-y divide-border">
      {rows.map((p) => (
        <li key={p.id}>
          <Link href={`/projects/work/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 transition hover:opacity-80">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{p.title}</span>
              <span className="text-xs text-muted">
                {p.client.username} → {p.dev.username} · {formatAmount(p.priceCents, locale)} · {when(p.updatedAt)}
              </span>
              {p.status === "DISPUTED" && p.disputeReason && <span className="mt-0.5 block max-w-xl truncate text-xs text-bad">{s.disputeReason(p.disputeReason)}</span>}
            </span>
            <Badge tone={tone(p.status)}>{s.projectStatus[p.status]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <PageTitle title={s.adminTitle} intro={s.adminIntro} />
      {disputes.length > 0 && (
        <div className="mb-4">
          <Panel title={s.adminDisputes}>{list(disputes)}</Panel>
        </div>
      )}
      <Panel title={s.adminAll}>{all.length === 0 ? <p className="py-2 text-sm text-muted">{s.adminNone}</p> : list(all)}</Panel>
    </>
  );
}
