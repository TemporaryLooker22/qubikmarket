import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Lightbulb, MessageCircle, MousePointerClick, Percent, ShoppingCart, UserRound, Users, Wallet, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatNumber } from "@/lib/i18n/format";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { categoryLabel } from "@/lib/catalog";
import { PERIODS, periodRange, type Bucket, type Period } from "@/lib/stats";
import { categoryConversion, perResource, sellerKpis, sellerResources, sellerSeries, unansweredConversations, viewSources, visitorDims, type ResourceRow, type SellerKpis } from "@/lib/seller-stats";
import { networkOf } from "@/lib/stats";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Panel } from "@/components/admin/AdminUi";
import { BarList } from "@/components/admin/stats/BarList";
import { StatsTabs } from "@/components/admin/stats/StatsTabs";
import { VisitsChart } from "@/components/admin/stats/VisitsChart";

export const dynamic = "force-dynamic";

const SELLER_PERIODS = PERIODS.filter((p) => p !== "today" && p !== "365");
const flag = (code: string) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.sellerStats.title };
}

// Mon espace → Statistiques (vendeurs) : vues de ses ressources et de son profil, clics sur Acheter et Contacter,
// ventes, d'où viennent les visiteurs, comparaison avec sa catégorie et conseils. Rien sur l'identité des visiteurs.
export default async function SellerStatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const user = await requireUser("/dashboard/stats");
  const [{ p }, { locale, t }, resources] = await Promise.all([searchParams, getDictionary(), sellerResources(user.id)]);
  if (resources.length === 0) redirect("/dashboard");
  const s = t.sellerStats;
  const period: Period = (SELLER_PERIODS as readonly string[]).includes(p ?? "") ? (p as Period) : "30";
  const range = periodRange(period);
  const { from, to } = range;

  const [current, previous, buckets, rows, sources, dims, unanswered] = await Promise.all([
    sellerKpis(user.id, user.username, resources, from, to),
    range.prevFrom && range.prevTo ? sellerKpis(user.id, user.username, resources, range.prevFrom, range.prevTo) : Promise.resolve(null),
    sellerSeries(user.id, resources, range),
    perResource(user.id, resources, from, to),
    viewSources(resources, from, to),
    visitorDims(resources, from, to),
    unansweredConversations(user.id),
  ]);
  const paidCategories = [...new Set(resources.filter((r) => r.priceCents > 0).map((r) => r.category))];
  const benchmark = await categoryConversion(paidCategories, from, to);

  const intl = locale === "fr" ? "fr-FR" : "en-GB";
  const num = (v: number) => formatNumber(v, locale);
  const pctSign = locale === "fr" ? " %" : "%";
  const rate = (v: number, total: number) => (total ? `${((v / total) * 100).toLocaleString(intl, { maximumFractionDigits: 1 })}${pctSign}` : "—");
  const countries = new Intl.DisplayNames([intl], { type: "region" });
  const countryName = (code: string) => {
    try {
      return code ? (countries.of(code) ?? code) : s.unknown;
    } catch {
      return code || s.unknown;
    }
  };
  const bucketLabel = (b: Bucket) =>
    range.unit === "day" ? b.date.toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" }) : b.date.toLocaleDateString(intl, { month: "short", year: "2-digit", timeZone: "UTC" });
  const bucketTip = (b: Bucket) => s.tooltip(bucketLabel(b), num(b.visitors), num(b.views), num(b.signups));

  // Libellé d'une provenance : page du site, campagne, site extérieur ou accès direct
  const sourceLabel = (key: string) => {
    if (key.startsWith("campaign:")) return `${s.campaign} ${key.slice(9)}`;
    if (key.startsWith("site:")) {
      const host = key.slice(5);
      const network = networkOf(host);
      return network === "other" ? host : `${s.networks[network] ?? host} (${host})`;
    }
    return s.from[key] ?? key;
  };
  const totalSourceViews = sources.reduce((a, b) => a + b.views, 0);

  const sellerRows = rows.filter((r) => r.status === "APPROVED" || r.views > 0 || r.sales > 0);
  const tips = buildTips(rows, unanswered, period, t);

  return (
    <>
      <DashboardHeader title={s.title} intro={s.intro} />
      <div role="radiogroup" className="mb-5 inline-flex flex-wrap gap-1 rounded-lg bg-surface p-[3px]">
        {SELLER_PERIODS.map((k) => (
          <Link
            key={k}
            href={k === "30" ? "/dashboard/stats" : `/dashboard/stats?p=${k}`}
            role="radio"
            aria-checked={k === period}
            className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${k === period ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"}`}
          >
            {t.stats.periods[k]}
          </Link>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi dark icon={Eye} label={s.kpiViews} value={num(current.views)} change={change(current, previous, "views", locale)} note={previous ? t.stats.vsPrevious : undefined} />
        <Kpi icon={Users} label={s.kpiVisitors} value={num(current.visitors)} change={change(current, previous, "visitors", locale)} />
        <Kpi icon={MousePointerClick} label={s.kpiBuyClicks} value={num(current.buyClicks)} change={change(current, previous, "buyClicks", locale)} />
        <Kpi icon={ShoppingCart} label={s.kpiSales} value={num(current.sales)} change={change(current, previous, "sales", locale)} note={current.downloads ? s.downloads(current.downloads) : undefined} />
        <Kpi icon={Percent} label={s.kpiConversion} value={rate(current.sales, current.visitors)} change={null} note={s.conversionNote} />
        <Kpi icon={Wallet} label={s.kpiRevenue} value={formatAmount(current.revenue, locale)} change={change(current, previous, "revenue", locale)} note={s.revenueNote} />
        <Kpi icon={MessageCircle} label={s.kpiContacts} value={num(current.contacts)} change={change(current, previous, "contacts", locale)} />
        <Kpi icon={UserRound} label={s.kpiProfile} value={num(current.profileViews)} change={change(current, previous, "profileViews", locale)} />
      </div>

      {tips.length > 0 && (
        <Panel title={s.tipsTitle} className="mb-4">
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {tip.text}
                  {tip.href && (
                    <>
                      {" "}
                      <Link href={tip.href} className="font-semibold underline underline-offset-2">
                        {tip.cta}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={s.chartTitle} className="mb-4" aside={<span className="text-xs text-muted">{s.chartLegend}</span>}>
        <VisitsChart buckets={buckets} label={bucketLabel} tooltip={bucketTip} />
      </Panel>

      <Panel title={s.resourcesTitle} className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="pb-2 font-bold">{s.colResource}</th>
                <th className="pb-2 text-right font-bold">{s.colViews}</th>
                <th className="pb-2 text-right font-bold">{s.colVisitors}</th>
                <th className="pb-2 text-right font-bold">{s.colBuyClicks}</th>
                <th className="pb-2 text-right font-bold">{s.colContacts}</th>
                <th className="pb-2 text-right font-bold">{s.colSales}</th>
                <th className="pb-2 text-right font-bold">{s.colConversion}</th>
                <th className="pb-2 text-right font-bold">{s.colRevenue}</th>
                <th className="pb-2 text-right font-bold">{s.colRating}</th>
              </tr>
            </thead>
            <tbody>
              {sellerRows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="max-w-0 py-2.5 pr-3">
                    <Link href={`/resources/${r.slug}`} className="block truncate font-semibold hover:underline">
                      {r.title}
                    </Link>
                    <span className="text-xs text-muted">
                      {categoryLabel(r.category)} · {r.priceCents ? formatAmount(r.priceCents, locale) : s.free}
                      {r.status !== "APPROVED" && ` · ${t.status[r.status as keyof typeof t.status] ?? r.status}`}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-semibold">{num(r.views)}</td>
                  <td className="py-2.5 text-right">{num(r.visitors)}</td>
                  <td className="py-2.5 text-right">{num(r.buyClicks)}</td>
                  <td className="py-2.5 text-right">{num(r.contacts)}</td>
                  <td className="py-2.5 text-right font-semibold">{r.priceCents ? num(r.sales) : `${num(r.downloads)}*`}</td>
                  <td className="py-2.5 text-right text-muted">{r.priceCents ? rate(r.sales, r.visitors) : rate(r.downloads, r.visitors)}</td>
                  <td className="py-2.5 text-right">{r.revenue ? formatAmount(r.revenue, locale) : "—"}</td>
                  <td className="py-2.5 text-right">{r.ratingCount ? `${r.ratingAvg.toLocaleString(intl, { maximumFractionDigits: 1 })} ★ (${r.ratingCount})` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">{s.tableNote}</p>
      </Panel>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Panel title={s.sourcesTitle}>
          <BarList
            rows={sources.map((x) => ({ key: x.key, label: sourceLabel(x.key), value: x.views, extra: rate(x.views, totalSourceViews) }))}
            head={[s.colSource, s.colViews, "%"]}
            empty={s.empty}
            format={num}
            limit={10}
          />
          <p className="mt-2 text-xs text-muted">{s.sourcesNote}</p>
        </Panel>
        <Panel title={s.compareTitle}>
          {paidCategories.length === 0 ? (
            <p className="text-sm text-muted">{s.compareFree}</p>
          ) : (
            <ul className="space-y-3">
              {paidCategories.map((category) => {
                const mine = rows.filter((r) => r.category === category && r.priceCents > 0);
                const myVisitors = mine.reduce((a, r) => a + r.visitors, 0);
                const mySales = mine.reduce((a, r) => a + r.sales, 0);
                // Moyenne des autres vendeurs de la catégorie (sans ses propres chiffres)
                const all = benchmark.get(category);
                const others = { visitors: Math.max(0, (all?.visitors ?? 0) - myVisitors), sales: Math.max(0, (all?.sales ?? 0) - mySales) };
                const enough = others.visitors >= 50;
                const myRate = myVisitors ? mySales / myVisitors : 0;
                const avgRate = others.visitors ? others.sales / others.visitors : 0;
                const close = Math.abs(myRate - avgRate) < 0.002;
                return (
                  <li key={category} className="rounded-xl bg-bg px-4 py-3">
                    <p className="text-sm font-semibold">{categoryLabel(category)}</p>
                    <div className="mt-1.5 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted">{s.compareYou}</p>
                        <p className="text-lg font-extrabold">{rate(mySales, myVisitors)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted">{s.compareAverage}</p>
                        <p className="text-lg font-extrabold">{enough ? rate(others.sales, others.visitors) : "—"}</p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {!enough ? s.compareNotEnough : myVisitors === 0 ? s.compareNoViews : close ? s.compareSame : myRate > avgRate ? s.compareAbove : s.compareBelow}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">{s.compareNote}</p>
        </Panel>
      </div>

      <StatsTabs
        title={s.audienceTitle}
        className="mb-4"
        tabs={[
          { label: t.stats.countriesTitle, content: <BarList rows={dims.country.map((d) => ({ key: d.value || "∅", label: `${d.value ? flag(d.value) : "🌐"} ${countryName(d.value)}`, value: d.visitors, extra: rate(d.visitors, current.visitors) }))} empty={s.empty} format={num} /> },
          { label: t.stats.devicesTitle, content: <BarList rows={dims.device.map((d) => ({ key: d.value || "∅", label: t.stats.devices[d.value] ?? d.value, value: d.visitors, extra: rate(d.visitors, current.visitors) }))} empty={s.empty} format={num} /> },
          { label: t.stats.localeTitle, content: <BarList rows={dims.locale.map((d) => ({ key: d.value || "∅", label: t.stats.locales[d.value] ?? d.value, value: d.visitors, extra: rate(d.visitors, current.visitors) }))} empty={s.empty} format={num} /> },
        ]}
      />

      <p className="text-xs leading-relaxed text-muted">{s.footnote}</p>
    </>
  );
}

type Tip = { text: string; href?: string; cta?: string };

// Conseils automatiques, d'après les chiffres de la période
function buildTips(rows: ResourceRow[], unanswered: number, period: Period, t: Dictionary): Tip[] {
  const s = t.sellerStats;
  const tips: Tip[] = [];
  if (unanswered > 0) tips.push({ text: s.tipUnanswered(unanswered), href: "/messages", cta: s.tipUnansweredCta });
  for (const r of rows.filter((x) => x.status === "APPROVED")) {
    const edit = `/dashboard/resources/${r.id}/edit`;
    if (r.images === 0) tips.push({ text: s.tipNoImage(r.title), href: `${edit}?tab=images`, cta: s.tipEdit });
    else if (r.priceCents > 0 && r.buyClicks >= 3 && r.sales === 0) tips.push({ text: s.tipAbandoned(r.title, r.buyClicks), href: `${edit}?tab=price`, cta: s.tipEdit });
    else if (r.priceCents > 0 && r.visitors >= 30 && r.sales === 0) tips.push({ text: s.tipNoSales(r.title, r.visitors), href: r.hasVideo ? `${edit}?tab=description` : `${edit}?tab=images`, cta: s.tipEdit });
    else if (r.descriptionLength < 400) tips.push({ text: s.tipShortDescription(r.title), href: `${edit}?tab=description`, cta: s.tipEdit });
    else if (!r.hasVideo && r.visitors >= 10) tips.push({ text: s.tipNoVideo(r.title), href: `${edit}?tab=images`, cta: s.tipEdit });
    if (r.sales >= 3 && r.ratingCount === 0) tips.push({ text: s.tipAskReviews(r.title) });
  }
  const totalVisitors = rows.reduce((a, r) => a + r.visitors, 0);
  if (period !== "7" && totalVisitors < 20) tips.push({ text: s.tipFewViews });
  return tips.slice(0, 6);
}

type Change = { good: boolean; text: string } | null;
function change(now: SellerKpis, before: SellerKpis | null, key: keyof SellerKpis, locale: Locale): Change {
  if (!before || !before[key]) return null;
  const p = Math.round(((now[key] - before[key]) / before[key]) * 100);
  return { good: p >= 0, text: `${p >= 0 ? "+" : "−"}${Math.abs(p)}${locale === "fr" ? " %" : "%"}` };
}

function Kpi({ icon: Icon, label, value, change, note, dark }: { icon: LucideIcon; label: string; value: string; change: Change; note?: string; dark?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${dark ? "border-text bg-text text-bg" : "border-border bg-card"}`}>
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${dark ? "text-bg/65" : "text-muted"}`}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 truncate text-2xl font-extrabold tracking-tight">{value}</p>
      {(change || note) && (
        <p className={`mt-0.5 truncate text-xs ${dark ? "text-bg/65" : "text-muted"}`}>
          {change && <strong className={change.good ? (dark ? "text-accent" : "text-ok") : dark ? "text-bg" : "text-bad"}>{change.text} </strong>}
          {note}
        </p>
      )}
    </div>
  );
}
