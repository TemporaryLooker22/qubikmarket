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
    <>
      <p>
        <Link href={`/resources?category=${resource.category}`}>{categoryLabel(resource.category)}</Link>
      </p>
      <h1>{resource.title}</h1>
      <p>{resource.summary}</p>
      <p>
        par <strong>{resource.seller.username}</strong> <ScanBadge verdict={resource.scanVerdict} />{" "}
        {resource.status !== "APPROVED" && <StatusBadge status={resource.status} />}
      </p>

      <h2>{formatPrice(resource.priceCents)}</h2>

      {bought && <p>C&apos;est à toi ! Tu peux télécharger le fichier.</p>}

      {canDownload ? (
        <p>
          <a href={`/api/download/${resource.id}`}>Télécharger</a>
        </p>
      ) : resource.status === "APPROVED" ? (
        <form action={buyResource}>
          <input type="hidden" name="resourceId" value={resource.id} />
          <button>{resource.priceCents === 0 ? "Obtenir gratuitement" : "Acheter"}</button>
        </form>
      ) : null}

      {!user && resource.priceCents > 0 && <p>Tu devras te connecter pour acheter.</p>}
      {isDemoMode && resource.priceCents > 0 && !canDownload && (
        <p>Mode démo : le paiement est simulé, aucun argent n&apos;est débité.</p>
      )}

      <ul>
        <li>Fichier : {resource.fileName}</li>
        <li>Taille : {formatSize(resource.fileSize)}</li>
        <li>Téléchargements : {resource._count.purchases}</li>
        <li>Publiée le : {resource.createdAt.toLocaleDateString("fr-FR")}</li>
      </ul>

      {resource.reviewNote && (isOwner || isAdmin) && (
        <>
          <h2>Note de modération</h2>
          <p>{resource.reviewNote}</p>
        </>
      )}

      <h2>Description</h2>
      <p style={{ whiteSpace: "pre-line" }}>{resource.description}</p>

      <h2>Rapport de sécurité</h2>
      {isOwner || isAdmin ? (
        <ScanReportView report={report} />
      ) : (
        <p>
          Ce fichier a été analysé par le scanner Qubik : {report.scriptCount} script(s) vérifié(s) à la recherche de
          backdoors (require cachés, code obfusqué, loadstring, webhooks, virus…).
          {resource.scanVerdict === "clean"
            ? " Aucun problème détecté."
            : " Certains éléments ont été relus et validés par un modérateur."}
        </p>
      )}
    </>
  );
}
