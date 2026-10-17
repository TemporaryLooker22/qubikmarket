import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/catalog";
import { PLATFORM_FEE_PERCENT } from "@/lib/payments";
import { ScanBadge } from "@/components/ScanBadge";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Mon espace" };

const PUBLISHED_MESSAGES: Record<string, string> = {
  approved: "Scan propre : ta ressource est en ligne !",
  pending: "Le scan a relevé des points à vérifier : un modérateur va relire ta ressource.",
  rejected: "Le scan a détecté du code dangereux : ta ressource a été refusée. Ouvre-la pour voir le rapport.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ published?: string }> }) {
  const user = await requireUser();
  const { published } = await searchParams;

  const [resources, purchases] = await Promise.all([
    db.resource.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { purchases: { where: { status: "PAID" }, select: { amountCents: true } } },
    }),
    db.purchase.findMany({
      where: { userId: user.id, status: "PAID" },
      orderBy: { createdAt: "desc" },
      include: { resource: { select: { id: true, slug: true, title: true } } },
    }),
  ]);

  const grossCents = resources.flatMap((r) => r.purchases).reduce((sum, p) => sum + p.amountCents, 0);
  const netCents = Math.round(grossCents * (1 - PLATFORM_FEE_PERCENT / 100));
  const sales = resources.reduce((n, r) => n + r.purchases.length, 0);
  const message = published ? PUBLISHED_MESSAGES[published] : null;

  return (
    <>
      <h1>Salut {user.username}</h1>
      <p>
        <Link href="/sell">+ Nouvelle ressource</Link>
      </p>

      {message && <p role="status">{message}</p>}

      <ul>
        <li>Ressources publiées : {resources.filter((r) => r.status === "APPROVED").length}</li>
        <li>Ventes et téléchargements : {sales}</li>
        <li>
          Revenus (après {PLATFORM_FEE_PERCENT} % de commission) : {formatPrice(netCents).replace("Gratuit", "0,00 €")}
        </li>
      </ul>

      <h2>Mes ressources</h2>
      {resources.length === 0 ? (
        <p>Tu n&apos;as encore rien publié.</p>
      ) : (
        <ul>
          {resources.map((r) => (
            <li key={r.id}>
              <Link href={`/resources/${r.slug}`}>{r.title}</Link> · {formatPrice(r.priceCents)}{" "}
              <ScanBadge verdict={r.scanVerdict} /> <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}

      <h2>Mes achats</h2>
      {purchases.length === 0 ? (
        <p>
          Aucun achat pour l&apos;instant. <Link href="/resources">Explore le catalogue</Link>
        </p>
      ) : (
        <ul>
          {purchases.map((p) => (
            <li key={p.id}>
              <Link href={`/resources/${p.resource.slug}`}>{p.resource.title}</Link> · {formatPrice(p.amountCents)} ·{" "}
              <a href={`/api/download/${p.resource.id}`}>Télécharger</a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
