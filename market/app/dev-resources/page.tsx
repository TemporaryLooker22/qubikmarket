import Link from "next/link";
import { ArrowRight, ExternalLink, Gift, Scale } from "lucide-react";
import { db } from "@/lib/db";
import { categoryLabel } from "@/lib/catalog";
import { pickPromoted } from "@/lib/promotion";
import { ResourceCard } from "@/components/ResourceCard";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { DEV_RESOURCES } from "@/lib/dev-resources";
import { DiscordIcon } from "@/components/DiscordIcon";
import { DISCORD_URL } from "@/lib/site";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.devResources.title, robots: { index: false } };
}

// Logo GitHub (lucide n'a pas les logos de marques)
function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

const MORE_COUNT = 3;

// Ressources de la catégorie en vente sur Qubik : d'abord les mises en avant payées, puis les mieux notées et les plus récentes
async function moreFromCatalog(category: string) {
  const promoted = await pickPromoted({ count: MORE_COUNT, category });
  const others = await db.resource.findMany({
    where: { status: "APPROVED", category, seller: { bannedAt: null }, id: { notIn: promoted.map((r) => r.id) } },
    orderBy: [{ ratingScore: "desc" }, { createdAt: "desc" }],
    take: MORE_COUNT,
    include: { seller: { select: { username: true } } },
  });
  return { list: [...promoted, ...others].slice(0, MORE_COUNT), sponsored: new Set(promoted.map((r) => r.id)) };
}

// Ressources gratuites pour développeurs Roblox, choisies par l'équipe Qubik (membres connectés seulement)
export default async function DevResourcesPage() {
  await requireUser("/dev-resources");
  const { locale, t } = await getDictionary();
  const s = t.devResources;
  const more = new Map(await Promise.all([...new Set(DEV_RESOURCES.flatMap((r) => (r.category ? [r.category] : [])))].map(async (c) => [c, await moreFromCatalog(c)] as const)));
  return (
    <div className="container-q pt-8">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-bold">
        <Gift className="h-3.5 w-3.5" aria-hidden="true" /> {s.badge}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{s.title}</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">{s.intro}</p>

      <ul className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-4">
        {DEV_RESOURCES.map((r) => (
          <li key={r.url} className="flex flex-col rounded-2xl border border-border bg-card p-5 transition hover:border-border-strong">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-text text-bg">
                {r.kind === "github" ? <GitHubIcon className="h-5 w-5" /> : <ExternalLink className="h-5 w-5" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{r.title}</h2>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  {r.kind === "github" ? "GitHub" : new URL(r.url).hostname}
                  {r.license && (
                    <span className="inline-flex items-center gap-1">
                      · <Scale className="h-3 w-3" aria-hidden="true" /> {s.license(r.license)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <p className="mt-3 max-w-3xl flex-1 text-sm leading-relaxed text-text/80">{r.description[locale] ?? r.description.en}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-muted">
                  {tag}
                </span>
              ))}
            </div>
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 sm:self-start text-sm font-semibold text-text transition hover:bg-accent-hover"
            >
              {r.kind === "github" ? s.openGithub : s.open} <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>

            {/* Pour aller plus loin : ressources de la même catégorie en vente sur Qubik */}
            {r.category && (more.get(r.category)?.list.length ?? 0) > 0 && (
              <section className="mt-5 border-t border-border pt-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{s.moreTitle(categoryLabel(r.category))}</h3>
                    <p className="text-xs text-muted">{s.moreIntro}</p>
                  </div>
                  <Link href={`/resources?category=${r.category}`} className="inline-flex items-center gap-1 text-sm font-semibold hover:underline">
                    {s.seeAll} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {more.get(r.category ?? "")!.list.map((res) => (
                    <ResourceCard key={res.slug} resource={res} locale={locale} sponsored={more.get(r.category ?? "")!.sponsored.has(res.id)} />
                  ))}
                </div>
              </section>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted">{s.suggest}</p>
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#5865F2] px-4 text-sm font-semibold text-white transition hover:bg-[#4752c4]">
          <DiscordIcon className="h-4 w-4" /> Discord
        </a>
      </div>
    </div>
  );
}
