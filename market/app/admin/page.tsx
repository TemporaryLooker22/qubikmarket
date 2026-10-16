import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { categoryLabel, formatPrice } from "@/lib/catalog";
import type { ScanReport } from "@/lib/scan";
import { moderateResource } from "@/app/actions";
import { ScanBadge } from "@/components/ScanBadge";
import { ScanReportView } from "@/components/ScanReportView";

export const metadata = { title: "Modération" };

export default async function AdminPage() {
  await requireAdmin();

  const [pending, stats] = await Promise.all([
    db.resource.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" }, // les plus anciennes d'abord
      include: { seller: { select: { username: true } } },
    }),
    db.resource.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: string) => stats.find((x) => x.status === s)?._count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Modération</h1>
        <p className="mt-2 text-muted">
          Seules les ressources au scan « à vérifier » arrivent ici. Les propres sont publiées automatiquement, les dangereuses refusées.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-muted">En attente</p><p className="text-2xl font-bold text-warn">{count("PENDING")}</p></div>
        <div className="card p-5"><p className="text-sm text-muted">En ligne</p><p className="text-2xl font-bold text-ok">{count("APPROVED")}</p></div>
        <div className="card p-5"><p className="text-sm text-muted">Refusées</p><p className="text-2xl font-bold text-bad">{count("REJECTED")}</p></div>
      </div>

      {pending.length === 0 ? (
        <p className="card p-8 text-center text-muted">File d&apos;attente vide 🎉</p>
      ) : (
        pending.map((r) => {
          const report = JSON.parse(r.scanReport) as ScanReport;
          const waitingHours = Math.round((Date.now() - r.createdAt.getTime()) / 36e5);
          return (
            <article key={r.id} className="card space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/resources/${r.slug}`} className="text-lg font-semibold hover:text-accent">{r.title}</Link>
                  <p className="text-sm text-muted">
                    {categoryLabel(r.category)} · {formatPrice(r.priceCents)} · par {r.seller.username} · en attente depuis {waitingHours} h
                  </p>
                </div>
                <ScanBadge verdict={r.scanVerdict} />
              </div>

              <ScanReportView report={report} />

              <form action={moderateResource} className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
                <input type="hidden" name="resourceId" value={r.id} />
                <div className="min-w-0 flex-[1_1_260px]">
                  <label className="label" htmlFor={`note-${r.id}`}>Note au vendeur (facultatif)</label>
                  <input id={`note-${r.id}`} name="note" className="input" placeholder="Ex. le loadstring est justifié, c'est un éditeur de code" />
                </div>
                <button name="decision" value="approve" className="btn">Approuver</button>
                <button name="decision" value="reject" className="btn-ghost text-bad">Refuser</button>
              </form>
            </article>
          );
        })
      )}
    </div>
  );
}
