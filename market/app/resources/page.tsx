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
      ...(q && {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { summary: { contains: q, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { seller: { select: { username: true } } },
  });

  return (
    <>
      <h1>Catalogue</h1>

      <form>
        <input name="q" defaultValue={q} placeholder="Rechercher (ex. système de porte, inventaire…)" />{" "}
        <select name="category" defaultValue={category}>
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>{" "}
        <select name="price" defaultValue={price}>
          <option value="">Tous les prix</option>
          <option value="free">Gratuit</option>
          <option value="paid">Payant</option>
        </select>{" "}
        <button>Filtrer</button>
      </form>

      {resources.length === 0 ? (
        <p>
          Aucune ressource ne correspond. <Link href="/resources">Réinitialiser les filtres</Link>
        </p>
      ) : (
        <ul>
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} />
          ))}
        </ul>
      )}
    </>
  );
}
