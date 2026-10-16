import Link from "next/link";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalog";
import { ResourceCard } from "@/components/ResourceCard";

export const metadata = { title: "Catalogue" };

type SearchParams = Promise<{ q?: string; category?: string; price?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "", category = "", price = "" } = await searchParams;

  const resources = await db.resource.findMany({
    where: {
      status: "APPROVED",
      ...(category && { category }),
      ...(price === "free" && { priceCents: 0 }),
      ...(price === "paid" && { priceCents: { gt: 0 } }),
      ...(q && { OR: [{ title: { contains: q } }, { summary: { contains: q } }] }),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { seller: { select: { username: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Catalogue</h1>

      <form className="card flex flex-wrap gap-3 p-4">
        <input name="q" defaultValue={q} placeholder="Rechercher (ex. système de porte, inventaire…)" className="input min-w-0 flex-[2_1_240px]" />
        <select name="category" defaultValue={category} className="input flex-[1_1_160px]">
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select name="price" defaultValue={price} className="input flex-[1_1_120px]">
          <option value="">Tous les prix</option>
          <option value="free">Gratuit</option>
          <option value="paid">Payant</option>
        </select>
        <button className="btn flex-[0_0_auto]">Filtrer</button>
      </form>

      {resources.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          Aucune ressource ne correspond.{" "}
          <Link href="/resources" className="text-accent hover:underline">
            Réinitialiser les filtres
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </div>
      )}
    </div>
  );
}
