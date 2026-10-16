import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatPrice } from "@/lib/catalog";
import { PLATFORM_FEE_PERCENT } from "@/lib/payments";
import { ScanBadge } from "@/components/ScanBadge";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Mon espace" };

const PUBLISHED_MESSAGES: Record<string, { cls: string; text: string }> = {
  approved: { cls: "bg-ok-bg text-ok", text: "Scan propre : ta ressource est en ligne ! 🎉" },
  pending: { cls: "bg-warn-bg text-warn", text: "Le scan a relevé des points à vérifier : un modérateur va relire ta ressource." },
  rejected: { cls: "bg-bad-bg text-bad", text: "Le scan a détecté du code dangereux : ta ressource a été refusée. Ouvre-la pour voir le rapport." },
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
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Salut {user.username} 👋</h1>
        <Link href="/sell" className="btn">+ Nouvelle ressource</Link>
      </div>

      {message && <p className={`rounded-lg p-4 ${message.cls}`}>{message.text}</p>}

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Ressources publiées" value={String(resources.filter((r) => r.status === "APPROVED").length)} />
        <Stat label="Ventes et téléchargements" value={String(sales)} />
        <Stat label={`Revenus (après ${PLATFORM_FEE_PERCENT} % de commission)`} value={formatPrice(netCents).replace("Gratuit", "0,00 €")} />
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Mes ressources</h2>
        {resources.length === 0 ? (
          <p className="card p-6 text-muted">Tu n&apos;as encore rien publié.</p>
        ) : (
          <div className="card divide-y divide-border">
            {resources.map((r) => (
              <Link key={r.id} href={`/resources/${r.slug}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-surface-2">
                <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                <span className="text-sm text-muted">{formatPrice(r.priceCents)}</span>
                <ScanBadge verdict={r.scanVerdict} />
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Mes achats</h2>
        {purchases.length === 0 ? (
          <p className="card p-6 text-muted">
            Aucun achat pour l&apos;instant. <Link href="/resources" className="text-accent hover:underline">Explore le catalogue</Link>
          </p>
        ) : (
          <div className="card divide-y divide-border">
            {purchases.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                <Link href={`/resources/${p.resource.slug}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent">
                  {p.resource.title}
                </Link>
                <span className="text-sm text-muted">{formatPrice(p.amountCents)}</span>
                <a href={`/api/download/${p.resource.id}`} className="btn-ghost py-1 text-sm">Télécharger</a>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
