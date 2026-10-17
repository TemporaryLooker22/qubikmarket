import Link from "next/link";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { ResourceCard } from "@/components/ResourceCard";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.catalog.title };
}

type SearchParams = Promise<{ q?: string; category?: string; price?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ q = "", category = "", price = "" }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);

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
      <h1>{t.catalog.title}</h1>

      <form>
        <input name="q" defaultValue={q} placeholder={t.catalog.searchPlaceholder} />{" "}
        <select name="category" defaultValue={category}>
          <option value="">{t.catalog.allCategories}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>{" "}
        <select name="price" defaultValue={price}>
          <option value="">{t.catalog.allPrices}</option>
          <option value="free">{t.catalog.free}</option>
          <option value="paid">{t.catalog.paid}</option>
        </select>{" "}
        <button>{t.catalog.filter}</button>
      </form>

      {resources.length === 0 ? (
        <p>
          {t.catalog.empty} <Link href="/resources">{t.catalog.reset}</Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} locale={locale} />
          ))}
        </div>
      )}
    </>
  );
}
