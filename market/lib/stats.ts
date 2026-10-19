import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { localDay, startOfLocalDay, TIME_ZONE } from "./analytics";

// Calculs de Modération → Statistiques, à partir des pages vues (PageView), des recherches (SearchLog),
// des inscriptions et des ventes. « Visiteurs » = visiteurs uniques de chaque jour, additionnés
// (l'empreinte anonyme change chaque jour, voir lib/analytics.ts).

export const PERIODS = ["today", "7", "30", "90", "365", "all"] as const;
export type Period = (typeof PERIODS)[number];
type Unit = "hour" | "day" | "month";
export type Range = { from: Date | null; to: Date; prevFrom: Date | null; prevTo: Date | null; unit: Unit };

const DAY = 86_400_000;

export function periodRange(period: Period, now = new Date()): Range {
  if (period === "today") {
    const from = startOfLocalDay(now);
    return { from, to: now, prevFrom: new Date(from.getTime() - DAY), prevTo: new Date(now.getTime() - DAY), unit: "hour" };
  }
  if (period === "all") return { from: null, to: now, prevFrom: null, prevTo: null, unit: "month" };
  const days = Number(period);
  const from = startOfLocalDay(new Date(now.getTime() - (days - 1) * DAY));
  const span = now.getTime() - from.getTime();
  return { from, to: now, prevFrom: new Date(from.getTime() - span), prevTo: from, unit: days > 90 ? "month" : "day" };
}

// Morceaux de requête SQL
const LOCAL = Prisma.raw(`("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE '${TIME_ZONE}')`);
const within = (from: Date | null, to: Date, column = '"createdAt"') =>
  from ? Prisma.sql`${Prisma.raw(column)} >= ${from} AND ${Prisma.raw(column)} < ${to}` : Prisma.sql`${Prisma.raw(column)} < ${to}`;
const HUMAN = Prisma.sql`"bot" IS NULL`;
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

// ---------- Chiffres clés ----------

export type Kpis = { visitors: number; views: number; bounce: number; signups: number; sales: number };

export async function kpis(from: Date | null, to: Date): Promise<Kpis> {
  const [[visits], signups, sales] = await Promise.all([
    db.$queryRaw<{ views: bigint; visitors: bigint; bounced: bigint }[]>`
      SELECT COUNT(*) AS views, COUNT(DISTINCT "visitor") AS visitors,
        (SELECT COUNT(*) FROM (SELECT "visitor" FROM "PageView" WHERE ${HUMAN} AND ${within(from, to)} GROUP BY "visitor" HAVING COUNT(*) = 1) b) AS bounced
      FROM "PageView" WHERE ${HUMAN} AND ${within(from, to)}`,
    db.user.count({ where: { createdAt: { ...(from && { gte: from }), lt: to } } }),
    db.purchase.count({ where: { status: "PAID", amountCents: { gt: 0 }, paidAt: { ...(from && { gte: from }), lt: to } } }),
  ]);
  const visitors = n(visits.visitors);
  return { visitors, views: n(visits.views), bounce: visitors ? n(visits.bounced) / visitors : 0, signups, sales };
}

// ---------- Courbe des visites ----------

export type Bucket = { key: string; date: Date; visitors: number; views: number; signups: number };

// Toutes les cases de la période (heures, jours ou mois, heure de Bruxelles), même vides
function bucketKeys(range: Range, first: Date | null): { key: string; date: Date }[] {
  const start = range.from ?? first ?? range.to;
  const keys: { key: string; date: Date }[] = [];
  if (range.unit === "hour") {
    const day = localDay(range.to);
    const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(range.to)) % 24;
    for (let h = 0; h <= hour; h++) keys.push({ key: `${day}T${String(h).padStart(2, "0")}`, date: new Date(`${day}T${String(h).padStart(2, "0")}:00:00Z`) });
    return keys;
  }
  const [y0, m0, d0] = localDay(start).split("-").map(Number);
  const end = localDay(range.to);
  if (range.unit === "day") {
    for (let t = Date.UTC(y0, m0 - 1, d0); ; t += DAY) {
      const key = new Date(t).toISOString().slice(0, 10);
      keys.push({ key, date: new Date(t) });
      if (key >= end || keys.length > 400) break;
    }
    return keys;
  }
  for (let y = y0, m = m0 - 1; ; m++) {
    const date = new Date(Date.UTC(y, m, 1));
    const key = date.toISOString().slice(0, 7);
    keys.push({ key, date });
    if (key >= end.slice(0, 7) || keys.length > 240) break;
  }
  return keys;
}

export async function series(range: Range): Promise<Bucket[]> {
  const unit = Prisma.raw(`'${range.unit}'`);
  const [visits, signups, first] = await Promise.all([
    db.$queryRaw<{ b: Date; views: bigint; visitors: bigint }[]>`
      SELECT date_trunc(${unit}, ${LOCAL}) AS b, COUNT(*) AS views, COUNT(DISTINCT "visitor") AS visitors
      FROM "PageView" WHERE ${HUMAN} AND ${within(range.from, range.to)} GROUP BY 1`,
    db.$queryRaw<{ b: Date; n: bigint }[]>`
      SELECT date_trunc(${unit}, ${LOCAL}) AS b, COUNT(*) AS n FROM "User" WHERE ${within(range.from, range.to)} GROUP BY 1`,
    range.from ? Promise.resolve(null) : db.pageView.findFirst({ where: { bot: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  const cut = range.unit === "hour" ? 13 : range.unit === "day" ? 10 : 7;
  const keyOf = (d: Date) => d.toISOString().slice(0, cut);
  const v = new Map(visits.map((r) => [keyOf(r.b), r]));
  const s = new Map(signups.map((r) => [keyOf(r.b), n(r.n)]));
  return bucketKeys(range, first?.createdAt ?? null).map(({ key, date }) => ({
    key,
    date,
    visitors: n(v.get(key)?.visitors),
    views: n(v.get(key)?.views),
    signups: s.get(key) ?? 0,
  }));
}

// ---------- Pages ----------

export type PageRow = { path: string; views: number; visitors: number };

export async function pages(from: Date | null, to: Date) {
  const [top, entry, exit] = await Promise.all([
    db.$queryRaw<{ path: string; views: bigint; visitors: bigint }[]>`
      SELECT "path", COUNT(*) AS views, COUNT(DISTINCT "visitor") AS visitors
      FROM "PageView" WHERE ${HUMAN} AND ${within(from, to)} GROUP BY "path" ORDER BY views DESC LIMIT 100`,
    db.$queryRaw<{ path: string; views: bigint }[]>`
      SELECT "path", COUNT(*) AS views FROM (
        SELECT DISTINCT ON ("visitor") "visitor", "path" FROM "PageView" WHERE ${HUMAN} AND ${within(from, to)} ORDER BY "visitor", "createdAt" ASC
      ) x GROUP BY "path" ORDER BY views DESC LIMIT 100`,
    db.$queryRaw<{ path: string; views: bigint }[]>`
      SELECT "path", COUNT(*) AS views FROM (
        SELECT DISTINCT ON ("visitor") "visitor", "path" FROM "PageView" WHERE ${HUMAN} AND ${within(from, to)} ORDER BY "visitor", "createdAt" DESC
      ) x GROUP BY "path" ORDER BY views DESC LIMIT 100`,
  ]);
  return {
    top: top.map((r) => ({ path: r.path, views: n(r.views), visitors: n(r.visitors) })),
    entry: entry.map((r) => ({ path: r.path, views: n(r.views), visitors: n(r.views) })),
    exit: exit.map((r) => ({ path: r.path, views: n(r.views), visitors: n(r.views) })),
  };
}

// ---------- Provenance, pays, appareils (d'après la première page de chaque visite) ----------

export type Dim = "referrer" | "campaign" | "source" | "country" | "device" | "browser" | "os" | "locale";
export type DimRow = { value: string; visitors: number };

export async function dimensions(from: Date | null, to: Date): Promise<Record<Dim, DimRow[]>> {
  const rows = await db.$queryRaw<{ dim: Dim; value: string | null; visitors: bigint }[]>`
    WITH v AS (
      SELECT DISTINCT ON ("visitor") "visitor", "source", "referrer", "campaign", "country", "device", "browser", "os", "locale"
      FROM "PageView" WHERE ${HUMAN} AND ${within(from, to)} ORDER BY "visitor", "createdAt" ASC
    )
    SELECT 'referrer' AS dim, "referrer" AS value, COUNT(*) AS visitors FROM v GROUP BY 2
    UNION ALL SELECT 'campaign', "campaign", COUNT(*) FROM v WHERE "campaign" IS NOT NULL GROUP BY 2
    UNION ALL SELECT 'source', "source", COUNT(*) FROM v GROUP BY 2
    UNION ALL SELECT 'country', "country", COUNT(*) FROM v GROUP BY 2
    UNION ALL SELECT 'device', "device", COUNT(*) FROM v GROUP BY 2
    UNION ALL SELECT 'browser', "browser", COUNT(*) FROM v GROUP BY 2
    UNION ALL SELECT 'os', "os", COUNT(*) FROM v GROUP BY 2
    UNION ALL SELECT 'locale', "locale", COUNT(*) FROM v GROUP BY 2`;
  const out = { referrer: [], campaign: [], source: [], country: [], device: [], browser: [], os: [], locale: [] } as Record<Dim, DimRow[]>;
  for (const r of rows) out[r.dim].push({ value: r.value ?? "", visitors: n(r.visitors) });
  for (const k of Object.keys(out) as Dim[]) out[k].sort((a, b) => b.visitors - a.visitors);
  return out;
}

// Grandes familles de sites d'origine (onglet « Réseaux »)
const NETWORKS: [RegExp, string][] = [
  [/(^|\.)(google|bing|duckduckgo|yahoo|ecosia|qwant|yandex|baidu|brave)\./, "search"],
  [/(^|\.)discord(app)?\.(com|gg)$/, "discord"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)roblox\.com$/, "roblox"],
  [/(^|\.)(x\.com|twitter\.com|t\.co|tiktok\.com|reddit\.com|instagram\.com|facebook\.com|threads\.net|bsky\.app)$/, "social"],
];
export function networkOf(referrer: string) {
  if (!referrer) return "direct";
  for (const [re, name] of NETWORKS) if (re.test(referrer)) return name;
  return "other";
}

// ---------- Robots ----------

export async function bots(from: Date | null, to: Date) {
  const rows = await db.$queryRaw<{ bot: string; views: bigint }[]>`
    SELECT "bot", COUNT(*) AS views FROM "PageView" WHERE "bot" IS NOT NULL AND ${within(from, to)} GROUP BY "bot" ORDER BY views DESC`;
  return rows.map((r) => ({ bot: r.bot, views: n(r.views) }));
}

// ---------- En ce moment (5 dernières minutes) ----------

export async function live() {
  const rows = await db.$queryRaw<{ path: string }[]>`
    SELECT DISTINCT ON ("visitor") "path" FROM "PageView"
    WHERE ${HUMAN} AND "createdAt" >= ${new Date(Date.now() - 5 * 60_000)} ORDER BY "visitor", "createdAt" DESC`;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.path, (counts.get(r.path) ?? 0) + 1);
  return { visitors: rows.length, pages: [...counts].map(([path, visitors]) => ({ path, visitors })).sort((a, b) => b.visitors - a.visitors).slice(0, 8) };
}

// ---------- Entonnoir ----------

const FIRST_PURCHASES = Prisma.sql`SELECT "userId", MIN("paidAt") AS first FROM "Purchase" WHERE "status" = 'PAID' AND "amountCents" > 0 GROUP BY "userId"`;

export async function funnel(from: Date | null, to: Date, visitorsBySource: DimRow[]) {
  const [[resourceViewers], signups, [buyers], signupsBySource, buyersBySource] = await Promise.all([
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT "visitor") AS n FROM "PageView" WHERE ${HUMAN} AND "path" LIKE '/resources/%' AND ${within(from, to)}`,
    db.user.count({ where: { createdAt: { ...(from && { gte: from }), lt: to } } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM (${FIRST_PURCHASES}) f WHERE ${within(from, to, "first")}`,
    db.user.groupBy({ by: ["signupSource"], where: { createdAt: { ...(from && { gte: from }), lt: to } }, _count: true }),
    db.$queryRaw<{ source: string | null; n: bigint }[]>`
      SELECT u."signupSource" AS source, COUNT(*) AS n FROM (${FIRST_PURCHASES}) f JOIN "User" u ON u."id" = f."userId"
      WHERE ${within(from, to, "f.first")} GROUP BY 1`,
  ]);
  // Par provenance : visiteurs, inscrits et premiers acheteurs
  const bySource = new Map<string, { source: string; visitors: number; signups: number; buyers: number }>();
  const row = (source: string) => bySource.get(source) ?? bySource.set(source, { source, visitors: 0, signups: 0, buyers: 0 }).get(source)!;
  for (const v of visitorsBySource) row(v.value || "direct").visitors += v.visitors;
  for (const s of signupsBySource) row(s.signupSource ?? "?").signups += s._count;
  for (const b of buyersBySource) row(b.source ?? "?").buyers += n(b.n);
  return {
    resourceViewers: n(resourceViewers.n),
    signups,
    buyers: n(buyers.n),
    bySource: [...bySource.values()].sort((a, b) => b.signups - a.signups || b.visitors - a.visitors).slice(0, 12),
  };
}

// ---------- Ressources : vues → ventes ----------

export async function resourceStats(from: Date | null, to: Date) {
  const [views, sales] = await Promise.all([
    db.$queryRaw<{ slug: string; views: bigint; visitors: bigint }[]>`
      SELECT substring("path" FROM 12) AS slug, COUNT(*) AS views, COUNT(DISTINCT "visitor") AS visitors
      FROM "PageView" WHERE ${HUMAN} AND "path" LIKE '/resources/%' AND ${within(from, to)} GROUP BY 1 ORDER BY views DESC LIMIT 50`,
    db.purchase.groupBy({
      by: ["resourceId"],
      where: { status: "PAID", amountCents: { gt: 0 }, paidAt: { ...(from && { gte: from }), lt: to } },
      _count: true,
      _sum: { amountCents: true, buyerFeeCents: true },
    }),
  ]);
  const resources = await db.resource.findMany({
    where: { OR: [{ slug: { in: views.map((v) => v.slug) } }, { id: { in: sales.map((s) => s.resourceId) } }] },
    select: { id: true, slug: true, title: true },
  });
  const bySlug = new Map(views.map((v) => [v.slug, v]));
  const salesById = new Map(sales.map((s) => [s.resourceId, s]));
  return resources
    .map((r) => {
      const v = bySlug.get(r.slug);
      const s = salesById.get(r.id);
      const revenue = (s?._sum.amountCents ?? 0) - (s?._sum.buyerFeeCents ?? 0);
      return { slug: r.slug, title: r.title, views: n(v?.views), visitors: n(v?.visitors), sales: s?._count ?? 0, revenue };
    })
    .sort((a, b) => b.views - a.views || b.sales - a.sales)
    .slice(0, 25);
}

// ---------- Recherches ----------

export async function searches(from: Date | null, to: Date) {
  const rows = await db.$queryRaw<{ term: string; n: bigint; results: number }[]>`
    SELECT "term", COUNT(*) AS n, (array_agg("results" ORDER BY "createdAt" DESC))[1] AS results
    FROM "SearchLog" WHERE ${within(from, to)} GROUP BY "term" ORDER BY n DESC, "term" LIMIT 40`;
  return rows.map((r) => ({ term: r.term, count: n(r.n), results: Number(r.results) }));
}

// ---------- Inscriptions d'aujourd'hui et d'hier ----------

export async function recentSignups() {
  const today = startOfLocalDay();
  const yesterday = new Date(today.getTime() - DAY);
  const users = await db.user.findMany({
    where: { createdAt: { gte: startOfLocalDay(new Date(yesterday.getTime() + DAY / 2)) } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, username: true, avatarUrl: true, createdAt: true, signupSource: true, signupCountry: true },
  });
  return { today: users.filter((u) => u.createdAt >= today), yesterday: users.filter((u) => u.createdAt < today) };
}
