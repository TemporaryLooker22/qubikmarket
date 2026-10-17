import Link from "next/link";
import { ArrowRight, Download, Plus, ScanSearch, Search, ShieldCheck, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalog";
import { CategoryIcon } from "@/components/CategoryIcon";
import { ResourceCard } from "@/components/ResourceCard";

export const dynamic = "force-dynamic";

// Les chiffres clés restent cachés tant que le site n'a pas assez de ressources (pour ne pas afficher « 0 vendeur »)
const SHOW_STATS_FROM = 100;

const sellerSelect = { seller: { select: { username: true } } };

export default async function HomePage() {
  const [featured, latest, topSales, stats] = await Promise.all([
    // Game Setups à la une : les plus récents
    db.resource.findMany({
      where: { status: "APPROVED", category: "game-setups" },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: sellerSelect,
    }),
    db.resource.findMany({
      where: { status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: sellerSelect,
    }),
    // Populaires : les ressources avec le plus d'achats payés (ou obtenus gratuitement)
    db.purchase.groupBy({
      by: ["resourceId"],
      where: { status: "PAID", resource: { status: "APPROVED" } },
      _count: { resourceId: true },
      orderBy: { _count: { resourceId: "desc" } },
      take: 4,
    }),
    Promise.all([
      db.resource.count(),
      db.resource.count({ where: { status: "REJECTED" } }),
      db.user.count({ where: { resources: { some: { status: "APPROVED" } } } }),
    ]),
  ]);

  // On récupère les ressources populaires en gardant l'ordre du classement
  const popularById = new Map(
    (
      await db.resource.findMany({
        where: { id: { in: topSales.map((t) => t.resourceId) } },
        include: sellerSelect,
      })
    ).map((r) => [r.id, r]),
  );
  const popular = topSales.flatMap((t) => popularById.get(t.resourceId) ?? []);

  const [scannedCount, blockedCount, sellerCount] = stats;
  const [mainSetup, ...otherSetups] = featured;

  return (
    <div className="full-bleed">
      {/* 1. Recherche */}
      <section className="container-q pb-10 pt-14 text-center sm:pb-12 sm:pt-20">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">Trouve ta prochaine ressource <span className="highlight">Roblox</span></h1>
        {/* Recherche minimaliste : un seul champ, on valide avec Entrée */}
        <form action="/resources" role="search" className="mx-auto mt-8 max-w-lg">
          <label className="flex items-center gap-3 rounded-full border border-border bg-card px-5 transition focus-within:border-text">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
            <span className="sr-only">Rechercher une ressource</span>
            <input
              name="q"
              type="search"
              placeholder="Rechercher un système, une map, une UI…"
              className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-muted"
            />
          </label>
        </form>
        <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Chaque fichier est scanné contre les backdoors
        </p>
      </section>

      {/* 2. Catégories : juste sous la recherche, visibles sans défiler */}
      <section className="container-q">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/resources?category=${c.id}`}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-2 py-5 text-center transition hover:-translate-y-0.5 hover:border-accent hover:bg-accent-soft"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg transition group-hover:bg-accent">
                <CategoryIcon category={c.id} className="h-[22px] w-[22px]" />
              </span>
              <span className="text-sm font-semibold">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Game Setups à la une (caché s'il n'y en a aucun) */}
      {mainSetup && (
        <section className="mt-16 bg-surface py-12">
          <div className="container-q">
            <SectionTitle title="Lance ton jeu ce week-end" subtitle="Game Setups : des jeux complets, prêts à publier." href="/resources?category=game-setups" />
            <div className={`grid gap-4 ${otherSetups.length ? "md:grid-cols-[2fr_1fr]" : ""}`}>
              <ResourceCard resource={mainSetup} size="large" />
              {otherSetups.length > 0 && (
                <div className="grid gap-4">
                  {otherSetups.map((r) => (
                    <ResourceCard key={r.id} resource={r} size="compact" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. Populaires (caché tant qu'il n'y a pas d'achats) */}
      {popular.length > 0 && (
        <section className="container-q mt-16">
          <SectionTitle title="Populaires" subtitle="Les plus téléchargées." href="/resources" />
          <CardGrid resources={popular} />
        </section>
      )}

      {/* 5. Nouveautés (caché tant qu'il n'y a pas de ressources) */}
      {latest.length > 0 && (
        <section className="container-q mt-16">
          <SectionTitle title="Nouveautés" subtitle="Tout juste publiées." href="/resources" />
          <CardGrid resources={latest} />
        </section>
      )}

      {/* 6. Comment ça marche */}
      <section className="mt-16 bg-surface py-12">
        <div className="container-q">
          <SectionTitle title="Comment ça marche" />
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              { icon: Upload, title: "Le vendeur publie", text: "Il envoie son fichier Roblox sur Qubik." },
              { icon: ScanSearch, title: "Qubik scanne", text: "Backdoors, code caché, virus : tout est vérifié avant la mise en vente." },
              { icon: Download, title: "Tu télécharges", text: "Tu récupères un fichier vérifié, sans mauvaise surprise." },
            ].map((step, i) => (
              <li key={step.title}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-text">
                    <step.icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                  </span>
                  <span className="text-sm text-muted">Étape {i + 1}</span>
                </div>
                <h3 className="mt-4 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 7. Chiffres clés (cachés au lancement, voir SHOW_STATS_FROM) */}
      {scannedCount >= SHOW_STATS_FROM && (
        <section className="container-q mt-16">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Ressources scannées" value={scannedCount} />
            <Stat label="Backdoors bloquées" value={blockedCount} />
            <Stat label="Vendeurs" value={sellerCount} />
          </div>
        </section>
      )}

      {/* 8. FAQ */}
      <section className="container-q mt-16">
        <SectionTitle title="Questions fréquentes" />
        <div className="max-w-3xl divide-y divide-border border-y border-border">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="h-4 w-4 shrink-0 transition group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

// TODO : ajouter « Je peux être remboursé ? » une fois la politique de remboursement décidée
const FAQ = [
  {
    q: "Comment fonctionne le scan anti-backdoor ?",
    a: "Chaque fichier envoyé est analysé automatiquement : require() cachés, code obfusqué, loadstring, webhooks, virus de plugin… Si le scan est propre, la ressource est en ligne tout de suite. S'il relève un doute, un modérateur la relit. Si le code est dangereux, elle est refusée.",
  },
  {
    q: "Comment je paie ?",
    a: "Par carte bancaire, via Stripe, une plateforme de paiement sécurisée. Qubik ne voit jamais tes coordonnées bancaires. Le fichier est téléchargeable dès que le paiement est validé.",
  },
  {
    q: "Combien prend Qubik sur une vente ?",
    a: "10 % du prix de vente. Le reste revient au vendeur. Publier une ressource gratuite ne coûte rien.",
  },
  {
    q: "Qubik est-il lié à Roblox ?",
    a: "Non. Qubik est une marketplace indépendante, qui n'est ni affiliée ni approuvée par Roblox Corporation.",
  },
];

function SectionTitle({ title, subtitle, href }: { title: string; subtitle?: string; href?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm text-muted hover:text-text">
          Tout voir <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function CardGrid({ resources }: { resources: React.ComponentProps<typeof ResourceCard>["resource"][] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {resources.map((r) => (
        <ResourceCard key={r.slug} resource={r} />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value.toLocaleString("fr-FR")}</p>
    </div>
  );
}
