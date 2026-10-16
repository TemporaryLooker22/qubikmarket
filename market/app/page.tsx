import Link from "next/link";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalog";
import { ResourceCard } from "@/components/ResourceCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const latest = await db.resource.findMany({
    where: { status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { seller: { select: { username: true } } },
  });

  return (
    <div className="space-y-14">
      <section className="py-10 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-accent">La marketplace 100 % Roblox</p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Des ressources Roblox <span className="text-accent">sans backdoor</span>, publiées en quelques secondes
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Scripts, modèles, interfaces, maps… Chaque fichier est scanné automatiquement. Pas de file d&apos;attente
          interminable : si le scan est propre, ta ressource est en ligne tout de suite.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/resources" className="btn px-6 py-3">
            Explorer le catalogue
          </Link>
          <Link href="/sell" className="btn-ghost px-6 py-3">
            Vendre une ressource
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { t: "Scan anti-backdoor", d: "require() cachés, code obfusqué, webhooks, virus : tout est vérifié avant la mise en ligne." },
          { t: "Publication instantanée", d: "Scan propre = en ligne immédiatement. Seuls les fichiers suspects passent par un modérateur." },
          { t: "Achat simple et sûr", d: "Paiement sécurisé, téléchargement immédiat, et l'assurance d'un fichier vérifié." },
        ].map((f) => (
          <div key={f.t} className="card p-5">
            <h2 className="font-semibold">{f.t}</h2>
            <p className="mt-1 text-sm text-muted">{f.d}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">Catégories</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Link key={c.id} href={`/resources?category=${c.id}`} className="btn-ghost py-1.5 text-sm">
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Nouveautés</h2>
          <Link href="/resources" className="text-sm text-accent hover:underline">
            Tout voir →
          </Link>
        </div>
        {latest.length === 0 ? (
          <div className="card p-8 text-center text-muted">
            Aucune ressource pour l&apos;instant.{" "}
            <Link href="/sell" className="text-accent hover:underline">
              Publie la première !
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((r) => (
              <ResourceCard key={r.id} resource={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
