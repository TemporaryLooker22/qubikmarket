import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { categoryLabel, formatPrice, formatSize } from "@/lib/catalog";
import { isDemoMode } from "@/lib/payments";
import type { ScanReport } from "@/lib/scan";
import { buyResource } from "@/app/actions";
import { ScanBadge } from "@/components/ScanBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ScanReportView } from "@/components/ScanReportView";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ bought?: string }>;

export default async function ResourcePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const { bought } = await searchParams;
  const user = await getCurrentUser();

  const resource = await db.resource.findUnique({
    where: { slug },
    include: { seller: { select: { id: true, username: true } }, _count: { select: { purchases: { where: { status: "PAID" } } } } },
  });
  if (!resource) notFound();

  const isOwner = user?.id === resource.sellerId;
  const isAdmin = user?.role === "ADMIN";
  // Une ressource pas encore validée n'est visible que par son vendeur et les modérateurs
  if (resource.status !== "APPROVED" && !isOwner && !isAdmin) notFound();

  const purchase = user
    ? await db.purchase.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId: resource.id } } })
    : null;
  const canDownload = isOwner || isAdmin || purchase?.status === "PAID";
  const report = JSON.parse(resource.scanReport) as ScanReport;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <article className="space-y-6">
        <div>
          <Link href={`/resources?category=${resource.category}`} className="text-sm text-accent hover:underline">
            {categoryLabel(resource.category)}
          </Link>
          <h1 className="mt-1 text-3xl font-bold">{resource.title}</h1>
          <p className="mt-2 text-lg text-muted">{resource.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>par <strong className="text-text">{resource.seller.username}</strong></span>
            <ScanBadge verdict={resource.scanVerdict} />
            {resource.status !== "APPROVED" && <StatusBadge status={resource.status} />}
          </div>
        </div>

        <section className="card p-6">
          <h2 className="mb-3 font-semibold">Description</h2>
          <div className="whitespace-pre-line leading-relaxed text-text/90">{resource.description}</div>
        </section>

        <section className="card p-6">
          <h2 className="mb-1 font-semibold">Rapport de sécurité</h2>
          {isOwner || isAdmin ? (
            <ScanReportView report={report} />
          ) : (
            <p className="text-sm text-muted">
              Ce fichier a été analysé par le scanner Qubik : {report.scriptCount} script(s) vérifié(s) à la recherche de
              backdoors (require cachés, code obfusqué, loadstring, webhooks, virus…).
              {resource.scanVerdict === "clean"
                ? " Aucun problème détecté."
                : " Certains éléments ont été relus et validés par un modérateur."}
            </p>
          )}
        </section>
      </article>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="card space-y-4 p-6">
          <div className="text-3xl font-extrabold">{formatPrice(resource.priceCents)}</div>

          {bought && <p className="rounded-lg bg-ok-bg p-3 text-sm text-ok">C&apos;est à toi ! Tu peux télécharger le fichier.</p>}

          {canDownload ? (
            <a href={`/api/download/${resource.id}`} className="btn w-full py-3">
              Télécharger
            </a>
          ) : resource.status === "APPROVED" ? (
            <form action={buyResource}>
              <input type="hidden" name="resourceId" value={resource.id} />
              <button className="btn w-full py-3">{resource.priceCents === 0 ? "Obtenir gratuitement" : "Acheter"}</button>
            </form>
          ) : null}

          {!user && resource.priceCents > 0 && <p className="text-xs text-muted">Tu devras te connecter pour acheter.</p>}
          {isDemoMode && resource.priceCents > 0 && !canDownload && (
            <p className="text-xs text-warn">Mode démo : le paiement est simulé, aucun argent n&apos;est débité.</p>
          )}

          <dl className="space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Fichier</dt><dd className="truncate pl-4">{resource.fileName}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Taille</dt><dd>{formatSize(resource.fileSize)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Téléchargements</dt><dd>{resource._count.purchases}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Publiée le</dt><dd>{resource.createdAt.toLocaleDateString("fr-FR")}</dd></div>
          </dl>
        </div>

        {resource.reviewNote && (isOwner || isAdmin) && (
          <div className="card p-4 text-sm">
            <p className="font-semibold">Note de modération</p>
            <p className="mt-1 text-muted">{resource.reviewNote}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
