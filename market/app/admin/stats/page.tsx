import Link from "next/link";
import { Eye, Layers, LogOut, ShoppingCart, UserPlus, Users, type LucideIcon } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatNumber } from "@/lib/i18n/format";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { bots, dimensions, funnel, kpis, live, networkOf, pages, PERIODS, periodRange, recentSignups, resourceStats, searches, series, type Bucket, type Kpis, type Period } from "@/lib/stats";
import { TIME_ZONE } from "@/lib/analytics";
import { PageTitle, Panel } from "@/components/admin/AdminUi";
import { UserAvatar } from "@/components/UserAvatar";
import { BarList, type BarRow } from "@/components/admin/stats/BarList";
import { StatsTabs } from "@/components/admin/stats/StatsTabs";
import { LiveCard } from "@/components/admin/stats/LiveCard";
import { VisitsChart } from "@/components/admin/stats/VisitsChart";

export const dynamic = "force-dynamic";

// Drapeau d'un pays à partir de son code (BE → 🇧🇪)
const flag = (code: string) => (/^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐");

// Modération → Statistiques : visites (mesurées sans cookie), pages, provenance, appareils, entonnoir,
// ressources vues → ventes, recherches et inscriptions. Robots et admins exclus des visites.
export default async function AdminStatsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const [{ p }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);
  const s = t.stats;
  const period: Period = PERIODS.includes(p as Period) ? (p as Period) : "30";
  const range = periodRange(period);
  const { from, to } = range;

  const [current, previous, buckets, pageLists, dims, botList, liveNow, resources, searchList, signups] = await Promise.all([
    kpis(from, to),
    range.prevFrom && range.prevTo ? kpis(range.prevFrom, range.prevTo) : Promise.resolve(null),
    series(range),
    pages(from, to),
    dimensions(from, to),
    bots(from, to),
    live(),
    resourceStats(from, to),
    searches(from, to),
    recentSignups(),
  ]);
  const funnelData = await funnel(from, to, dims.source);

  const intl = locale === "fr" ? "fr-FR" : "en-GB";
  const num = (v: number) => formatNumber(v, locale);
  const pct = (v: number, total: number) => (total ? `${Math.round((v / total) * 100)}${locale === "fr" ? " %" : "%"}` : "—");
  const rate = (v: number, total: number) => (total ? `${((v / total) * 100).toLocaleString(intl, { maximumFractionDigits: 1 })}${locale === "fr" ? " %" : "%"}` : "—");
  const countries = new Intl.DisplayNames([intl], { type: "region" });
  const countryName = (code: string) => {
    try {
      return code ? (countries.of(code) ?? code) : s.unknown;
    } catch {
      return code || s.unknown;
    }
  };
  const pageLabel = (path: string) => (path === "/" ? s.home : path === "/dashboard" || path === "/messages" || path === "/checkout" ? `${path} (${s.private})` : path);
  const visitors = current.visitors;

  // Lignes des listes
  const pageRows = (list: { path: string; views: number; visitors: number }[], withVisitors: boolean): BarRow[] =>
    list.map((r) => ({ key: r.path, label: pageLabel(r.path), value: r.views, extra: withVisitors ? num(r.visitors) : pct(r.views, visitors), href: r.path.startsWith("/dashboard") || r.path.startsWith("/messages") || r.path.startsWith("/checkout") ? undefined : r.path }));
  const dimRows = (list: { value: string; visitors: number }[], label: (v: string) => React.ReactNode): BarRow[] =>
    list.map((r) => ({ key: r.value || "∅", label: label(r.value), value: r.visitors, extra: pct(r.visitors, visitors) }));
  const networks = new Map<string, number>();
  for (const r of dims.referrer) networks.set(networkOf(r.value), (networks.get(networkOf(r.value)) ?? 0) + r.visitors);

  // Courbe : libellés et bulles
  const bucketLabel = (b: Bucket) =>
    range.unit === "hour" ? `${b.key.slice(11)} h` : range.unit === "day" ? b.date.toLocaleDateString(intl, { day: "numeric", month: "short", timeZone: "UTC" }) : b.date.toLocaleDateString(intl, { month: "short", year: "2-digit", timeZone: "UTC" });
  const bucketTip = (b: Bucket) => s.tooltip(bucketLabel(b), num(b.visitors), num(b.views), num(b.signups));

  const hasData = current.views > 0 || botList.length > 0;
  const time = (d: Date) => d.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
  const signupTable = (list: typeof signups.today) =>
    list.length === 0 ? (
      <p className="py-2 text-sm text-muted">{s.signupsEmpty}</p>
    ) : (
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="pb-1.5 font-bold">{s.colMember}</th>
            <th className="pb-1.5 font-bold">{s.colFrom}</th>
            <th className="pb-1.5 font-bold">{s.colCountry}</th>
            <th className="pb-1.5 text-right font-bold">{s.colTime}</th>
          </tr>
        </thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="py-2 pr-2">
                <Link href={`/admin/users?id=${u.id}`} className="flex items-center gap-2 font-semibold hover:underline">
                  <UserAvatar name={u.username} src={u.avatarUrl} size={24} />
                  <span className="truncate">{u.username}</span>
                </Link>
              </td>
              <td className="py-2 pr-2 text-muted">{u.signupSource === "direct" || !u.signupSource ? s.direct : u.signupSource}</td>
              <td className="py-2 pr-2" title={u.signupCountry ? countryName(u.signupCountry) : s.unknown}>
                {u.signupCountry ? flag(u.signupCountry) : "—"}
              </td>
              <td className="py-2 text-right text-muted">{time(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );

  return (
    <>
      <PageTitle title={t.mod.menu.stats} intro={s.intro}>
        <div role="radiogroup" className="inline-flex flex-wrap gap-1 rounded-lg bg-surface p-[3px]">
          {PERIODS.map((k) => (
            <Link
              key={k}
              href={k === "30" ? "/admin/stats" : `/admin/stats?p=${k}`}
              role="radio"
              aria-checked={k === period}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${k === period ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"}`}
            >
              {s.periods[k]}
            </Link>
          ))}
        </div>
      </PageTitle>

      {!hasData && <p className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-sm">{s.noData}</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <Kpi dark icon={Users} label={s.kpiVisitors} value={num(current.visitors)} change={change(current, previous, "visitors", locale)} note={previous ? s.vsPrevious : undefined} />
        <Kpi icon={Eye} label={s.kpiViews} value={num(current.views)} change={change(current, previous, "views", locale)} />
        <Kpi
          icon={Layers}
          label={s.kpiPerVisit}
          value={current.visitors ? (current.views / current.visitors).toLocaleString(intl, { maximumFractionDigits: 1 }) : "—"}
          change={previous && previous.visitors && current.visitors ? delta(current.views / current.visitors, previous.views / previous.visitors, locale) : null}
        />
        <Kpi icon={LogOut} label={s.kpiBounce} value={current.visitors ? pct(current.bounce * 100, 100) : "—"} change={previous && previous.visitors && current.visitors ? points(current.bounce, previous.bounce, locale) : null} />
        <Kpi icon={UserPlus} label={s.kpiSignups} value={num(current.signups)} change={change(current, previous, "signups", locale)} note={period !== "today" ? s.todayCount(signups.today.length) : undefined} />
        <Kpi icon={ShoppingCart} label={s.kpiSales} value={num(current.sales)} change={change(current, previous, "sales", locale)} />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title={s.chartTitle[range.unit]} aside={<Legend t={t} />}>
          <VisitsChart buckets={buckets} label={bucketLabel} tooltip={bucketTip} />
          <p className="mt-2 text-xs text-muted">{s.chartNote}</p>
        </Panel>
        <LiveCard initial={liveNow} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <StatsTabs
          title={s.pagesTitle}
          tabs={[
            { label: s.tabTop, content: <BarList rows={pageRows(pageLists.top, true)} head={[s.colPage, s.colViews, s.colVisitors]} empty={s.empty} format={num} limit={10} /> },
            { label: s.tabEntry, content: <BarList rows={pageRows(pageLists.entry, false)} head={[s.colPage, s.colVisits, "%"]} empty={s.empty} format={num} limit={10} /> },
            { label: s.tabExit, content: <BarList rows={pageRows(pageLists.exit, false)} head={[s.colPage, s.colVisits, "%"]} empty={s.empty} format={num} limit={10} /> },
          ]}
        />
        <StatsTabs
          title={s.sourcesTitle}
          tabs={[
            { label: s.tabSites, content: <BarList rows={dimRows(dims.referrer, (v) => v || s.direct)} head={[s.colOrigin, s.colVisitors, "%"]} empty={s.empty} format={num} limit={10} /> },
            { label: s.tabCampaigns, content: <BarList rows={dimRows(dims.campaign, (v) => v)} head={[s.colCampaign, s.colVisitors, "%"]} empty={s.noCampaigns} format={num} limit={10} /> },
            {
              label: s.tabNetworks,
              content: (
                <BarList
                  rows={[...networks].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: s.networks[k] ?? k, value: v, extra: pct(v, visitors) }))}
                  head={[s.colNetwork, s.colVisitors, "%"]}
                  empty={s.empty}
                  format={num}
                />
              ),
            },
          ]}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <StatsTabs title={s.countriesTitle} tabs={[{ label: "", content: <BarList rows={dimRows(dims.country, (v) => `${v ? flag(v) : "🌐"} ${countryName(v)}`)} empty={s.empty} format={num} /> }]} />
        <StatsTabs
          title={s.devicesTitle}
          tabs={[
            { label: s.tabType, content: <BarList rows={dimRows(dims.device, (v) => s.devices[v] ?? v)} empty={s.empty} format={num} /> },
            { label: s.tabBrowser, content: <BarList rows={dimRows(dims.browser, (v) => (v === "Autre" ? s.other : v))} empty={s.empty} format={num} /> },
            { label: s.tabOs, content: <BarList rows={dimRows(dims.os, (v) => (v === "Autre" ? s.other : v))} empty={s.empty} format={num} /> },
          ]}
        />
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 font-semibold">{s.localeTitle}</h2>
          <BarList rows={dimRows(dims.locale, (v) => s.locales[v] ?? v)} empty={s.empty} format={num} />
          <div className="mb-3 mt-5 flex items-center justify-between gap-2">
            <h2 className="font-semibold">{s.botsTitle}</h2>
            <span className="text-xs text-muted">{s.botsNote}</span>
          </div>
          <BarList rows={botList.map((b) => ({ key: b.bot, label: b.bot === "Autre robot" ? s.otherBot : b.bot, value: b.views }))} empty={s.botsEmpty} format={num} />
        </section>
      </div>

      <div className="mb-4 grid gap-4 2xl:grid-cols-2">
        <Panel title={s.funnelTitle}>
          <div className="space-y-2.5">
            {[
              [s.stepVisitors, visitors],
              [s.stepResource, funnelData.resourceViewers],
              [s.stepSignups, funnelData.signups],
              [s.stepBuyers, funnelData.buyers],
            ].map(([label, value]) => (
              <div key={label as string} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_56px] items-center gap-3 text-sm">
                <span className="font-semibold">{label}</span>
                <span className="h-8 overflow-hidden rounded-lg bg-surface">
                  <span className="flex h-full min-w-[2.75rem] items-center rounded-lg bg-accent px-2.5 font-extrabold" style={{ width: `${visitors ? Math.max(3, ((value as number) / visitors) * 100) : 0}%` }}>
                    {num(value as number)}
                  </span>
                </span>
                <span className="text-right text-xs font-bold text-muted">{rate(value as number, visitors)}</span>
              </div>
            ))}
          </div>
          {funnelData.bySource.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[420px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="pb-1.5 font-bold">{s.colOrigin}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colVisitors}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colSignups}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colBuyers}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colConv}</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelData.bySource.map((r) => (
                    <tr key={r.source} className="border-t border-border">
                      <td className="py-2 pr-2">{r.source === "direct" ? s.direct : r.source === "?" ? s.unknown : r.source}</td>
                      <td className="py-2 text-right">{num(r.visitors)}</td>
                      <td className="py-2 text-right font-semibold">{num(r.signups)}</td>
                      <td className="py-2 text-right font-semibold">{num(r.buyers)}</td>
                      <td className="py-2 text-right text-muted">{rate(r.signups, r.visitors)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">{s.funnelNote}</p>
            </div>
          )}
        </Panel>

        <Panel title={s.resourcesTitle} aside={<span className="text-xs text-muted">{s.resourcesNote}</span>}>
          {resources.length === 0 ? (
            <p className="text-sm text-muted">{s.empty}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="pb-1.5 font-bold">{s.colResource}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colViews}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colSales}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colConv}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colRevenue}</th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr key={r.slug} className="border-t border-border">
                      <td className="max-w-0 py-2 pr-2">
                        <Link href={`/resources/${r.slug}`} className="block truncate font-semibold hover:underline">
                          {r.title}
                        </Link>
                      </td>
                      <td className="py-2 text-right">{num(r.views)}</td>
                      <td className="py-2 text-right font-semibold">{num(r.sales)}</td>
                      <td className="py-2 text-right text-muted">{rate(r.sales, r.visitors)}</td>
                      <td className="py-2 text-right">{r.revenue ? formatAmount(r.revenue, locale) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={s.searchesTitle}>
          {searchList.length === 0 ? (
            <p className="text-sm text-muted">{s.searchesEmpty}</p>
          ) : (
            <>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                    <th className="pb-1.5 font-bold">{s.colTerm}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colTimes}</th>
                    <th className="pb-1.5 text-right font-bold">{s.colResults}</th>
                  </tr>
                </thead>
                <tbody>
                  {searchList.slice(0, 15).map((r) => (
                    <tr key={r.term} className="border-t border-border">
                      <td className="max-w-0 truncate py-2 pr-2">
                        <Link href={`/resources?q=${encodeURIComponent(r.term)}`} className="hover:underline">
                          {r.term}
                        </Link>
                      </td>
                      <td className="py-2 text-right font-semibold">{num(r.count)}</td>
                      <td className="py-2 text-right">
                        {r.results === 0 ? <span className="rounded-full bg-bad-bg px-2 py-0.5 text-[11px] font-bold text-bad">0</span> : num(r.results)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">{s.searchesNote}</p>
            </>
          )}
        </Panel>
        <StatsTabs
          title={s.signupsTitle}
          tabs={[
            { label: s.signupsToday(signups.today.length), content: signupTable(signups.today) },
            { label: s.signupsYesterday(signups.yesterday.length), content: signupTable(signups.yesterday) },
          ]}
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">{s.footnote}</p>
    </>
  );
}

function Legend({ t }: { t: Dictionary }) {
  return (
    <span className="flex flex-wrap gap-3 text-xs text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> {t.stats.legendVisitors}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-surface" /> {t.stats.legendViews}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" /> {t.stats.legendSignups}
      </span>
    </span>
  );
}

type Change = { up: boolean; good: boolean; text: string } | null;

function delta(now: number, before: number, locale: Locale): Change {
  if (!before) return null;
  const p = Math.round(((now - before) / before) * 100);
  return { up: p >= 0, good: p >= 0, text: `${p >= 0 ? "+" : "−"}${Math.abs(p)}${locale === "fr" ? " %" : "%"}` };
}
function change(now: Kpis, before: Kpis | null, key: keyof Kpis, locale: Locale): Change {
  return before ? delta(now[key], before[key], locale) : null;
}
// Rebond : en points, et une baisse est une bonne nouvelle
function points(now: number, before: number, locale: Locale): Change {
  const d = Math.round((now - before) * 100);
  return { up: d >= 0, good: d <= 0, text: `${d >= 0 ? "+" : "−"}${Math.abs(d)} ${locale === "fr" ? "pts" : "pts"}` };
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
