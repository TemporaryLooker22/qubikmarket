import Link from "next/link";
import { ArrowRight, Crown, ImageIcon, Percent, Plus, ShieldCheck, Zap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_BEST_SELLERS, DEMO_ENABLED } from "@/lib/demo";
import { getDictionary } from "@/lib/i18n/server";
import { FOUNDER_FEE_PERCENT, FOUNDER_MONTHS, FOUNDER_SPOTS, founderSpotsLeft } from "@/lib/sellers";
import { HeroCards, type HeroCard } from "@/components/seller/HeroCards";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.seller.metaTitle };
}

const WHY_ICONS = [Zap, ShieldCheck, Percent, ImageIcon];

// Cartes du haut de page : exemples de démo, sinon de vraies ressources avec images, sinon des cartes génériques
async function getHeroCards(placeholders: HeroCard[]): Promise<HeroCard[]> {
  if (DEMO_ENABLED) {
    return DEMO_BEST_SELLERS.slice(0, 3).map(({ resource, sales }) => ({ ...resource, sales }));
  }
  const resources = await db.resource.findMany({
    where: { status: "APPROVED", NOT: { images: { isEmpty: true } } },
    orderBy: { purchases: { _count: "desc" } },
    take: 3,
    select: { title: true, category: true, priceCents: true, images: true, _count: { select: { purchases: { where: { status: "PAID" } } } } },
  });
  if (resources.length < 3) return placeholders;
  return resources.map((r) => ({ title: r.title, category: r.category, priceCents: r.priceCents, image: r.images[0], sales: r._count.purchases }));
}

// Page « Devenir vendeur » : convaincre les créateurs Roblox de vendre sur Qubik
export default async function BecomeSellerPage() {
  const [{ locale, t }, user, spotsLeft] = await Promise.all([getDictionary(), getCurrentUser(), founderSpotsLeft()]);
  const heroCards = await getHeroCards(t.seller.placeholders);
  // Bouton principal : formulaire de vente si connecté, sinon inscription puis retour sur le formulaire
  const ctaHref = user ? "/sell" : `/register?next=${encodeURIComponent("/sell")}`;

  return (
    <div className="full-bleed">
      {/* Programme vendeurs fondateurs : bandeau discret en haut de page */}
      {spotsLeft > 0 && (
        <div className="container-q pt-6">
          <p className="animate-fade-up flex items-center justify-center gap-2 text-center text-xs text-muted">
            <Crown className="h-3.5 w-3.5 shrink-0 text-accent-hover" aria-hidden="true" />
            {t.seller.founderBanner(FOUNDER_SPOTS, FOUNDER_FEE_PERCENT, FOUNDER_MONTHS)}
          </p>
        </div>
      )}

      {/* Hero */}
      <section className="container-q grid items-center gap-10 pb-12 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div className="animate-fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted">{t.seller.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
            {t.seller.titleA}
            <br />
            <span className="highlight">{t.seller.titleB}</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">{t.seller.intro}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={ctaHref} className="group inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 text-[15px] font-semibold transition hover:-translate-y-px hover:bg-accent-hover">
              {t.seller.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
          <HeroCards cards={heroCards} locale={locale} />
        </div>
      </section>

      {/* Pourquoi Qubik */}
      <section className="reveal container-q mt-4">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">{t.seller.whyTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.seller.why.map((item, i) => {
            const Icon = WHY_ICONS[i];
            return (
              <div key={item.title} className="group rounded-2xl border border-border bg-card p-6 transition duration-300 hover:-translate-y-1 hover:border-accent hover:shadow-[0_16px_32px_-18px_rgba(0,0,0,0.25)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-bg transition group-hover:bg-accent">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mt-16 bg-surface py-14">
        <div className="reveal container-q">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight sm:text-3xl">{t.seller.howTitle}</h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.seller.steps.map((step, i) => (
              <li key={step.title} className="relative">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-text text-sm font-bold text-bg">{i + 1}</span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ vendeurs */}
      <section className="reveal container-q mt-16">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight sm:text-3xl">{t.seller.faqTitle}</h2>
        <div className="max-w-3xl divide-y divide-border border-y border-border">
          {t.seller.faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus className="h-4 w-4 shrink-0 transition duration-300 group-open:rotate-45" aria-hidden="true" />
              </summary>
              <p className="animate-fade-up mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Dernier appel */}
      <section className="reveal container-q mt-16">
        <div className="flex flex-col items-center rounded-3xl bg-accent px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.seller.finalTitle}</h2>
          <p className="mt-2 text-text/70">{t.seller.finalText}</p>
          <Link href={ctaHref} className="group mt-6 inline-flex h-12 items-center gap-2 rounded-xl bg-text px-6 text-[15px] font-semibold text-bg transition hover:-translate-y-px">
            {t.seller.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
