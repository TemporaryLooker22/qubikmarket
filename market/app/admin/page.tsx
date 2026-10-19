import Link from "next/link";
import { Clock, Flag, History, MessageSquareWarning, MessagesSquare, Percent, ShieldCheck, ShoppingCart, Store, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { formatAmount, formatNumber } from "@/lib/i18n/format";
import { findUnanalyzedVersionIds, kickAiQueue, queueLength } from "@/lib/ai/run";
import { hasAiKey } from "@/lib/ai/ovh";
import { moderationCounts, QUEUE_RESOURCES, QUEUE_VERSIONS } from "@/lib/moderation";
import { analyzeExistingResources } from "@/app/resource-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PageTitle, Panel, Stat } from "@/components/admin/AdminUi";
import { RevenueBars } from "@/components/admin/RevenueBars";
import { StripeBalancePanel } from "@/components/admin/StripeBalancePanel";
import { platformBalance } from "@/lib/platform-balance";

// La file d'analyse IA avance en arrière-plan après la réponse (voir lib/ai/run.ts)
export const maxDuration = 120;

const DAY = 24 * 60 * 60 * 1000;
const PERIODS = ["7", "30", "all"] as const;
type Period = (typeof PERIODS)[number];

// Chiffres d'une période : ventes payées et ce qui revient à Qubik (commission + frais de service hors TVA)
async function money(from: Date | null, to: Date) {
  const range = { ...(from && { gte: from }), lt: to };
  const [purchases, earnings] = await Promise.all([
    db.purchase.aggregate({
      where: { status: "PAID", amountCents: { gt: 0 }, paidAt: range },
      _sum: { amountCents: true, taxCents: true, buyerFeeCents: true, buyerFeeTaxCents: true },
      _count: true,
    }),
    db.sellerEarning.aggregate({ where: { purchaseId: { not: null }, status: { not: "CANCELED" }, createdAt: range }, _sum: { feeCents: true, amountCents: true } }),
  ]);
  const fees = (purchases._sum.buyerFeeCents ?? 0) - (purchases._sum.buyerFeeTaxCents ?? 0);
  return {
    sales: purchases._count,
    collected: purchases._sum.amountCents ?? 0,
    tax: purchases._sum.taxCents ?? 0,
    sellers: earnings._sum.amountCents ?? 0,
    fees,
    qubik: (earnings._sum.feeCents ?? 0) + fees,
  };
}

function delta(now: number, before: number, locale: string) {
  if (before === 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  return { up: pct >= 0, text: `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}${locale === "fr" ? " %" : "%"}` };
}

// Modération → Vue d'ensemble : chiffres du site sur la période choisie, à faire, analyse IA
export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const [{ period: raw }, { locale, t }] = await Promise.all([searchParams, getDictionary()]);
  const period: Period = PERIODS.includes(raw as Period) ? (raw as Period) : "30";
  const now = new Date();
  const days = period === "all" ? null : Number(period);
  const from = days ? new Date(now.getTime() - days * DAY) : null;
  const before = days ? new Date(now.getTime() - 2 * days * DAY) : null;

  const [current, previous, members, previousMembers, totalMembers, activeSellers, counts, oldest, aiQueue, unanalyzed, paidList, balance] = await Promise.all([
    money(from, now),
    from ? money(before, from) : null,
    db.user.count({ where: from ? { createdAt: { gte: from } } : {} }),
    from ? db.user.count({ where: { createdAt: { gte: before!, lt: from } } }) : null,
    db.user.count(),
    db.resource.groupBy({ by: ["sellerId"], where: { status: "APPROVED" } }).then((g) => g.length),
    moderationCounts(),
    // Élément le plus ancien à vérifier (ressource ou version)
    Promise.all([
      db.resource.findFirst({ where: QUEUE_RESOURCES, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      db.resourceVersion.findFirst({ where: QUEUE_VERSIONS, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]).then((list) => list.filter(Boolean).map((x) => x!.createdAt.getTime()).sort()[0] ?? null),
    queueLength(),
    findUnanalyzedVersionIds(),
    // Ventes de la période pour le graphique
    db.purchase.findMany({
      where: { status: "PAID", amountCents: { gt: 0 }, ...(from && { paidAt: { gte: from } }) },
      select: { paidAt: true, buyerFeeCents: true, buyerFeeTaxCents: true, earning: { select: { feeCents: true, status: true } } },
    }),
    // Solde Stripe et part des vendeurs (une panne de Stripe ne doit pas bloquer la page)
    platformBalance().catch(() => null),
  ]);
  if (aiQueue > 0) kickAiQueue();



  // Barres : une par jour (7 et 30 jours), ou une par mois (tout)
  const intl = locale === "fr" ? "fr-FR" : "en-GB";
  const buckets = new Map<string, number>();
  const keyOf = (d: Date) => (days ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7));
  for (const p of paidList) {
    if (!p.paidAt) continue;
    const qubik = (p.earning && p.earning.status !== "CANCELED" ? p.earning.feeCents : 0) + p.buyerFeeCents - p.buyerFeeTaxCents;
    buckets.set(keyOf(p.paidAt), (buckets.get(keyOf(p.paidAt)) ?? 0) + qubik);
  }
  let keys: string[];
  if (days) {
    keys = Array.from({ length: days }, (_, i) => keyOf(new Date(now.getTime() - (days - 1 - i) * DAY)));
  } else {
    const first = paidList.reduce((m, p) => (p.paidAt && p.paidAt < m ? p.paidAt : m), now);
    keys = [];
    for (let d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)); d <= now; d.setUTCMonth(d.getUTCMonth() + 1)) keys.push(keyOf(d));
  }
  const bars = keys.map((k) => {
    const date = new Date(days ? `${k}T12:00:00Z` : `${k}-15T12:00:00Z`);
    const label = date.toLocaleDateString(intl, days ? { day: "numeric", month: "short" } : { month: "short", year: "numeric" });
    const value = buckets.get(k) ?? 0;
    return { label, value, title: `${label} : ${formatAmount(value, locale)}` };
  });

  const wait = oldest ? t.mod.hours(Math.floor((now.getTime() - oldest) / 36e5)) : null;
  const periodHref = (p: Period) => (p === "30" ? "/admin" : `/admin?period=${p}`);

  return (
    <>
      {aiQueue > 0 && <AutoRefresh />}
      <PageTitle title={t.mod.menu.overview} intro={t.mod.overviewIntro}>
        <div role="radiogroup" className="inline-flex gap-1 rounded-lg bg-surface p-[3px]">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={periodHref(p)}
              role="radio"
              aria-checked={p === period}
              className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${p === period ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"}`}
            >
              {t.mod.periods[p]}
            </Link>
          ))}
        </div>
      </PageTitle>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat dark icon={Wallet} label={t.mod.revenue} value={formatAmount(current.qubik, locale)} delta={previous && delta(current.qubik, previous.qubik, locale)} note={t.mod.revenueNote} />
        <Stat icon={ShoppingCart} label={t.mod.sales} value={formatNumber(current.sales, locale)} delta={previous && delta(current.sales, previous.sales, locale)} note={t.mod.salesNote(formatAmount(current.collected, locale))} />
        <Stat icon={Store} label={t.mod.sellers} value={formatNumber(activeSellers, locale)} note={t.mod.sellersNote} />
        <Stat icon={UserPlus} label={t.mod.members} value={formatNumber(members, locale)} delta={previousMembers !== null ? delta(members, previousMembers, locale) : null} note={t.mod.membersNote(totalMembers)} />
      </div>

      {balance && <StripeBalancePanel data={balance} t={t} locale={locale} />}

      <Panel title={days ? t.mod.chartDay : t.mod.chartMonth} aside={<span className="text-xs text-muted">{t.mod.revenueNote}</span>}>
        <RevenueBars bars={bars} />
      </Panel>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Panel title={t.mod.todo}>
          {counts.queue + counts.flags + counts.reports + counts.chats === 0 ? (
            <p className="py-2 text-sm text-muted">{t.mod.todoNone}</p>
          ) : (
            <ul className="divide-y divide-border">
              {counts.queue > 0 && <Todo icon={ShieldCheck} tone="bg-accent-soft" title={t.mod.todoQueue(counts.queue)} note={wait ? t.mod.todoOldest(wait) : ""} href="/admin/queue" open={t.mod.open} />}
              {counts.flags > 0 && <Todo icon={Flag} tone="bg-warn-bg text-warn" title={t.mod.todoFlags(counts.flags)} note={t.mod.todoFlagsNote} href="/admin/flags" open={t.mod.open} />}
              {counts.reports > 0 && <Todo icon={MessageSquareWarning} tone="bg-bad-bg text-bad" title={t.mod.todoReports(counts.reports)} note={t.mod.todoReportsNote} href="/admin/reviews" open={t.mod.open} />}
              {counts.chats > 0 && <Todo icon={MessagesSquare} tone="bg-bad-bg text-bad" title={t.mod.todoChats(counts.chats)} note={t.mod.todoChatsNote} href="/admin/messages" open={t.mod.open} />}
            </ul>
          )}
        </Panel>

        <Panel title={t.mod.aiTitle}>
          <ul className="divide-y divide-border">
            <Todo icon={Clock} tone="bg-surface" title={aiQueue ? t.mod.aiQueue(aiQueue) : t.mod.aiQueueEmpty} note={t.mod.aiQueueNote(hasAiKey())} />
            {unanalyzed.length > 0 && (
              <Todo icon={History} tone="bg-surface" title={t.mod.aiOld(unanalyzed.length)} note={t.mod.aiOldNote}>
                <form action={analyzeExistingResources} className="ml-auto">
                  <button className="shrink-0 text-sm font-semibold hover:underline">{t.mod.analyze}</button>
                </form>
              </Todo>
            )}
            <Todo
              icon={Percent}
              tone="bg-surface"
              title={t.mod.money(formatAmount(current.collected, locale))}
              note={t.mod.moneyNote(formatAmount(current.sellers, locale), formatAmount(current.tax, locale), formatAmount(current.qubik, locale), formatAmount(current.fees, locale))}
            />
          </ul>
        </Panel>
      </div>

      {/* Visites, provenance et inscriptions en détail : Modération → Statistiques */}
      <Link href="/admin/stats" className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm font-semibold transition hover:border-border-strong">
        {t.stats.intro}
        <span className="shrink-0">{t.mod.menu.stats} →</span>
      </Link>
    </>
  );
}

function Todo({ icon: Icon, tone, title, note, href, open, children }: { icon: LucideIcon; tone: string; title: string; note: string; href?: string; open?: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      {href && (
        <Link href={href} className="ml-auto shrink-0 text-sm font-semibold hover:underline">
          {open} →
        </Link>
      )}
      {children}
    </li>
  );
}
