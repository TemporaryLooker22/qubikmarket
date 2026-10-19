import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { TIME_ZONE } from "./analytics";
import type { Bucket, Range } from "./stats";
import { localDay } from "./analytics";

// Mon espace → Statistiques : les chiffres d'un vendeur, seulement sur ses ressources et son profil.
// Tout est compté en totaux (on ne montre jamais qui a vu ou cliqué).

const HUMAN = Prisma.sql`"bot" IS NULL`;
const LOCAL = Prisma.raw(`("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${TIME_ZONE}')`);
const within = (from: Date | null, to: Date, column = '"createdAt"') =>
  from ? Prisma.sql`${Prisma.raw(column)} >= ${from} AND ${Prisma.raw(column)} < ${to}` : Prisma.sql`${Prisma.raw(column)} < ${to}`;
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const DAY = 86_400_000;

export type SellerResource = {
  id: string;
  slug: string;
  title: string;
  category: string;
  priceCents: number;
  status: string;
  images: number;
  hasVideo: boolean;
  descriptionLength: number;
  ratingAvg: number;
  ratingCount: number;
};

export async function sellerResources(sellerId: string): Promise<SellerResource[]> {
  const list = await db.resource.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, category: true, priceCents: true, status: true, images: true, videoId: true, description: true, ratingAvg: true, ratingCount: true },
  });
  return list.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    category: r.category,
    priceCents: r.priceCents,
    status: r.status,
    images: r.images.length,
    hasVideo: Boolean(r.videoId),
    descriptionLength: r.description.length,
    ratingAvg: r.ratingAvg,
    ratingCount: r.ratingCount,
  }));
}

const pathsOf = (resources: SellerResource[]) => resources.map((r) => `/resources/${r.slug}`);

// ---------- Chiffres clés ----------

export type SellerKpis = { views: number; visitors: number; profileViews: number; buyClicks: number; contacts: number; sales: number; downloads: number; revenue: number };

export async function sellerKpis(sellerId: string, username: string, resources: SellerResource[], from: Date | null, to: Date): Promise<SellerKpis> {
  const paths = pathsOf(resources);
  const ids = resources.map((r) => r.id);
  const range = { ...(from && { gte: from }), lt: to };
  const [[views], [profile], buyClicks, contacts, sales, downloads, revenue] = await Promise.all([
    paths.length
      ? db.$queryRaw<{ views: bigint; visitors: bigint }[]>`SELECT COUNT(*) AS views, COUNT(DISTINCT "visitor") AS visitors FROM "PageView" WHERE ${HUMAN} AND "path" = ANY(${paths}) AND ${within(from, to)}`
      : Promise.resolve([{ views: BigInt(0), visitors: BigInt(0) }]),
    db.$queryRaw<{ views: bigint }[]>`SELECT COUNT(*) AS views FROM "PageView" WHERE ${HUMAN} AND "path" = ${`/u/${username}`} AND ${within(from, to)}`,
    // Clics sur Acheter / Obtenir : un achat est préparé à chaque premier clic d'un membre connecté
    db.purchase.count({ where: { resource: { sellerId }, createdAt: range } }),
    // Conversations ouvertes depuis une de ses ressources (carte « À propos de »)
    ids.length ? db.message.count({ where: { kind: "ABOUT", resourceId: { in: ids }, createdAt: range } }) : Promise.resolve(0),
    db.purchase.count({ where: { status: "PAID", amountCents: { gt: 0 }, resource: { sellerId }, paidAt: range } }),
    db.purchase.count({ where: { status: "PAID", amountCents: 0, resource: { sellerId }, paidAt: range } }),
    db.sellerEarning.aggregate({ where: { sellerId, purchaseId: { not: null }, status: { not: "CANCELED" }, createdAt: range }, _sum: { amountCents: true } }),
  ]);
  return {
    views: n(views.views),
    visitors: n(views.visitors),
    profileViews: n(profile.views),
    buyClicks,
    contacts,
    sales,
    downloads,
    revenue: revenue._sum.amountCents ?? 0,
  };
}

// ---------- Courbe : vues de ses ressources (et ventes) ----------

export async function sellerSeries(sellerId: string, resources: SellerResource[], range: Range): Promise<Bucket[]> {
  const paths = pathsOf(resources);
  const unit = Prisma.raw(`'${range.unit}'`);
  const [visits, sales, first] = await Promise.all([
    paths.length
      ? db.$queryRaw<{ b: Date; views: bigint; visitors: bigint }[]>`
          SELECT date_trunc(${unit}, ${LOCAL}) AS b, COUNT(*) AS views, COUNT(DISTINCT "visitor") AS visitors
          FROM "PageView" WHERE ${HUMAN} AND "path" = ANY(${paths}) AND ${within(range.from, range.to)} GROUP BY 1`
      : Promise.resolve([]),
    db.$queryRaw<{ b: Date; n: bigint }[]>`
      SELECT date_trunc(${unit}, ("paidAt" AT TIME ZONE 'UTC' AT TIME ZONE ${TIME_ZONE})) AS b, COUNT(*) AS n
      FROM "Purchase" p JOIN "Resource" r ON r."id" = p."resourceId"
      WHERE r."sellerId" = ${sellerId} AND p."status" = 'PAID' AND p."amountCents" > 0 AND ${within(range.from, range.to, 'p."paidAt"')} GROUP BY 1`,
    range.from ? Promise.resolve(null) : db.resource.findFirst({ where: { sellerId }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const cut = range.unit === "hour" ? 13 : range.unit === "day" ? 10 : 7;
  const keyOf = (d: Date) => d.toISOString().slice(0, cut);
  const v = new Map(visits.map((r) => [keyOf(r.b), r]));
  const s = new Map(sales.map((r) => [keyOf(r.b), n(r.n)]));
  // Cases de la période (même logique que les statistiques du site)
  const start = range.from ?? first?.createdAt ?? range.to;
  const keys: { key: string; date: Date }[] = [];
  if (range.unit === "hour") {
    const day = localDay(range.to);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(range.to)) % 24;
    for (let h = 0; h <= hour; h++) keys.push({ key: `${day}T${String(h).padStart(2, "0")}`, date: new Date(`${day}T${String(h).padStart(2, "0")}:00:00Z`) });
  } else if (range.unit === "day") {
    const [y, m, d] = localDay(start).split("-").map(Number);
    const end = localDay(range.to);
    for (let t = Date.UTC(y, m - 1, d); ; t += DAY) {
      const key = new Date(t).toISOString().slice(0, 10);
      keys.push({ key, date: new Date(t) });
      if (key >= end || keys.length > 400) break;
    }
  } else {
    const [y0, m0] = localDay(start).split("-").map(Number);
    const end = localDay(range.to).slice(0, 7);
    for (let m = m0 - 1; ; m++) {
      const date = new Date(Date.UTC(y0, m, 1));
      const key = date.toISOString().slice(0, 7);
      keys.push({ key, date });
      if (key >= end || keys.length > 240) break;
    }
  }
  // signups = ventes ici (point vert sur la courbe)
  return keys.map(({ key, date }) => ({ key, date, visitors: n(v.get(key)?.visitors), views: n(v.get(key)?.views), signups: s.get(key) ?? 0 }));
}

// ---------- Ressource par ressource ----------

export type ResourceRow = SellerResource & { views: number; visitors: number; buyClicks: number; contacts: number; sales: number; downloads: number; revenue: number };

export async function perResource(sellerId: string, resources: SellerResource[], from: Date | null, to: Date): Promise<ResourceRow[]> {
  const paths = pathsOf(resources);
  const ids = resources.map((r) => r.id);
  const range = { ...(from && { gte: from }), lt: to };
  const [views, clicks, contacts, sales, downloads, earnings] = await Promise.all([
    paths.length
      ? db.$queryRaw<{ path: string; views: bigint; visitors: bigint }[]>`
          SELECT "path", COUNT(*) AS views, COUNT(DISTINCT "visitor") AS visitors FROM "PageView" WHERE ${HUMAN} AND "path" = ANY(${paths}) AND ${within(from, to)} GROUP BY "path"`
      : Promise.resolve([]),
    db.purchase.groupBy({ by: ["resourceId"], where: { resource: { sellerId }, createdAt: range }, _count: true }),
    ids.length ? db.message.groupBy({ by: ["resourceId"], where: { kind: "ABOUT", resourceId: { in: ids }, createdAt: range }, _count: true }) : Promise.resolve([]),
    db.purchase.groupBy({ by: ["resourceId"], where: { status: "PAID", amountCents: { gt: 0 }, resource: { sellerId }, paidAt: range }, _count: true }),
    db.purchase.groupBy({ by: ["resourceId"], where: { status: "PAID", amountCents: 0, resource: { sellerId }, paidAt: range }, _count: true }),
    db.sellerEarning.findMany({ where: { sellerId, status: { not: "CANCELED" }, purchaseId: { not: null }, createdAt: range }, select: { amountCents: true, purchase: { select: { resourceId: true } } } }),
  ]);
  const byPath = new Map(views.map((v) => [v.path, v]));
  const count = (list: { resourceId: string | null; _count: number }[]) => new Map(list.map((x) => [x.resourceId, x._count]));
  const [c, k, s, d] = [count(clicks), count(contacts), count(sales), count(downloads)];
  const revenue = new Map<string, number>();
  for (const e of earnings) if (e.purchase) revenue.set(e.purchase.resourceId, (revenue.get(e.purchase.resourceId) ?? 0) + e.amountCents);
  return resources.map((r) => {
    const v = byPath.get(`/resources/${r.slug}`);
    return { ...r, views: n(v?.views), visitors: n(v?.visitors), buyClicks: c.get(r.id) ?? 0, contacts: k.get(r.id) ?? 0, sales: s.get(r.id) ?? 0, downloads: d.get(r.id) ?? 0, revenue: revenue.get(r.id) ?? 0 };
  });
}

// ---------- D'où viennent les vues ----------

// Page du site d'où l'on vient (home, catalog…), sinon l'origine de la visite (site extérieur, campagne, accès direct)
export async function viewSources(resources: SellerResource[], from: Date | null, to: Date) {
  const paths = pathsOf(resources);
  if (!paths.length) return [];
  const rows = await db.$queryRaw<{ key: string; views: bigint }[]>`
    SELECT CASE
        WHEN "from" IS NOT NULL THEN "from"
        WHEN "campaign" IS NOT NULL THEN 'campaign:' || "campaign"
        WHEN "referrer" IS NOT NULL THEN 'site:' || "referrer"
        ELSE 'direct' END AS key, COUNT(*) AS views
    FROM "PageView" WHERE ${HUMAN} AND "path" = ANY(${paths}) AND ${within(from, to)} GROUP BY 1 ORDER BY views DESC`;
  return rows.map((r) => ({ key: r.key, views: n(r.views) }));
}

// Pays, appareils et langue des visiteurs de ses ressources (une fois par visiteur)
export async function visitorDims(resources: SellerResource[], from: Date | null, to: Date) {
  const paths = pathsOf(resources);
  const empty = { country: [], device: [], locale: [] } as Record<"country" | "device" | "locale", { value: string; visitors: number }[]>;
  if (!paths.length) return empty;
  const rows = await db.$queryRaw<{ dim: "country" | "device" | "locale"; value: string | null; visitors: bigint }[]>`
    WITH v AS (SELECT DISTINCT ON ("visitor") "country", "device", "locale" FROM "PageView" WHERE ${HUMAN} AND "path" = ANY(${paths}) AND ${within(from, to)} ORDER BY "visitor", "createdAt")
    SELECT 'country' AS dim, "country" AS value, COUNT(*) AS visitors FROM v GROUP BY 2
    UNION ALL SELECT 'device', "device", COUNT(*) FROM v GROUP BY 2
    UNION ALL SELECT 'locale', "locale", COUNT(*) FROM v GROUP BY 2`;
  for (const r of rows) empty[r.dim].push({ value: r.value ?? "", visitors: n(r.visitors) });
  for (const k of Object.keys(empty) as (keyof typeof empty)[]) empty[k].sort((a, b) => b.visitors - a.visitors);
  return empty;
}

// ---------- Comparaison : conversion moyenne de chaque catégorie sur Qubik ----------

export async function categoryConversion(categories: string[], from: Date | null, to: Date) {
  if (!categories.length) return new Map<string, { visitors: number; sales: number }>();
  const [visitors, sales] = await Promise.all([
    db.$queryRaw<{ category: string; visitors: bigint }[]>`
      SELECT r."category", COUNT(DISTINCT pv."visitor") AS visitors
      FROM "PageView" pv JOIN "Resource" r ON pv."path" = '/resources/' || r."slug"
      WHERE pv."bot" IS NULL AND r."priceCents" > 0 AND r."category" = ANY(${categories}) AND ${within(from, to, 'pv."createdAt"')} GROUP BY 1`,
    db.$queryRaw<{ category: string; sales: bigint }[]>`
      SELECT r."category", COUNT(*) AS sales FROM "Purchase" p JOIN "Resource" r ON r."id" = p."resourceId"
      WHERE p."status" = 'PAID' AND p."amountCents" > 0 AND r."category" = ANY(${categories}) AND ${within(from, to, 'p."paidAt"')} GROUP BY 1`,
  ]);
  const out = new Map<string, { visitors: number; sales: number }>();
  for (const v of visitors) out.set(v.category, { visitors: n(v.visitors), sales: 0 });
  for (const s of sales) out.set(s.category, { visitors: out.get(s.category)?.visitors ?? 0, sales: n(s.sales) });
  return out;
}

// ---------- Messagerie : questions restées sans réponse ----------

export async function unansweredConversations(sellerId: string) {
  return db.conversation.count({ where: { OR: [{ userAId: sellerId }, { userBId: sellerId }], lastSenderId: { not: null }, NOT: { lastSenderId: sellerId } } });
}
