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
    <>
      <h1>Modération</h1>
      <p>
        Seules les ressources au scan « à vérifier » arrivent ici. Les propres sont publiées automatiquement, les dangereuses refusées.
      </p>

      <ul>
        <li>En attente : {count("PENDING")}</li>
        <li>En ligne : {count("APPROVED")}</li>
        <li>Refusées : {count("REJECTED")}</li>
      </ul>

      {pending.length === 0 ? (
        <p>File d&apos;attente vide.</p>
      ) : (
        pending.map((r) => {
          const report = JSON.parse(r.scanReport) as ScanReport;
          const waitingHours = Math.round((Date.now() - r.createdAt.getTime()) / 36e5);
          return (
            <article key={r.id}>
              <hr />
              <h2>
                <Link href={`/resources/${r.slug}`}>{r.title}</Link> <ScanBadge verdict={r.scanVerdict} />
              </h2>
              <p>
                {categoryLabel(r.category)} · {formatPrice(r.priceCents)} · par {r.seller.username} · en attente depuis {waitingHours} h
              </p>

              <ScanReportView report={report} />

              <form action={moderateResource}>
                <input type="hidden" name="resourceId" value={r.id} />
                <label htmlFor={`note-${r.id}`}>Note au vendeur (facultatif)</label>
                <br />
                <input id={`note-${r.id}`} name="note" placeholder="Ex. le loadstring est justifié, c'est un éditeur de code" />{" "}
                <button name="decision" value="approve">Approuver</button>{" "}
                <button name="decision" value="reject">Refuser</button>
              </form>
            </article>
          );
        })
      )}
    </>
  );
}
