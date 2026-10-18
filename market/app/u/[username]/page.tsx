import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Clock, Crown, MessageCircle, Settings, Store } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/i18n/format";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { isOnline, responseTime } from "@/lib/chat";
import { canMemberReview, memberRating, purchasesBetween, VISIBLE_MEMBER_REVIEW, type MemberRole } from "@/lib/member-reviews";
import { submitMemberReview } from "@/app/member-actions";
import { ResourceCard } from "@/components/ResourceCard";
import { Stars } from "@/components/Stars";
import { UserAvatar } from "@/components/UserAvatar";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { MemberReviewItem, type MemberReviewData } from "@/components/profile/MemberReviewItem";

type Params = Promise<{ username: string }>;
type Tab = "resources" | "seller" | "buyer";

const memberSelect = { id: true, username: true, avatarUrl: true, createdAt: true, founderUntil: true, lastSeenAt: true } as const;
const findMember = (username: string) => db.user.findFirst({ where: { username: decodeURIComponent(username), bannedAt: null }, select: memberSelect });
const formatRating = (n: number, locale: Locale) => n.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export async function generateMetadata({ params }: { params: Params }) {
  const member = await findMember((await params).username);
  return member ? { title: member.username } : {};
}

// Profil public d'un membre : ses ressources en vente, les avis reçus en tant que vendeur et en tant qu'acheteur.
// On n'y montre jamais ce qu'il a acheté. Un compte banni n'a plus de profil.
export default async function ProfilePage({ params, searchParams }: { params: Params; searchParams: Promise<{ tab?: string }> }) {
  const [{ username }, { tab: rawTab }, viewer, { locale, t }] = await Promise.all([params, searchParams, getCurrentUser(), getDictionary()]);
  const member = await findMember(username);
  if (!member) notFound();

  const reviewInclude = { author: { select: { id: true, username: true, avatarUrl: true } } } as const;
  const [resources, sales, sellerStats, buyerStats, response, sellerReviews, buyerReviews] = await Promise.all([
    db.resource.findMany({ where: { sellerId: member.id, status: "APPROVED" }, orderBy: { createdAt: "desc" }, include: { seller: { select: { username: true } } } }),
    db.purchase.count({ where: { status: "PAID", resource: { sellerId: member.id } } }),
    memberRating(member.id, "SELLER"),
    memberRating(member.id, "BUYER"),
    responseTime(member.id),
    db.memberReview.findMany({ where: { targetId: member.id, role: "SELLER", ...VISIBLE_MEMBER_REVIEW }, orderBy: { createdAt: "desc" }, include: reviewInclude }),
    db.memberReview.findMany({ where: { targetId: member.id, role: "BUYER", ...VISIBLE_MEMBER_REVIEW }, orderBy: { createdAt: "desc" }, include: reviewInclude }),
  ]);

  // Onglets : Ressources et Avis vendeur seulement pour ceux qui vendent (ou ont déjà des avis vendeur)
  const isSeller = resources.length > 0 || sales > 0;
  const tabs: Tab[] = [...(isSeller ? (["resources"] as Tab[]) : []), ...(isSeller || sellerReviews.length ? (["seller"] as Tab[]) : []), "buyer"];
  const tab: Tab = tabs.includes(rawTab as Tab) ? (rawTab as Tab) : tabs[0];
  const isMe = viewer?.id === member.id;
  const founder = Boolean(member.founderUntil && member.founderUntil > new Date());
  const online = isOnline(member.lastSeenAt);
  const since = member.createdAt.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" });

  // Ce que le visiteur peut faire sur l'onglet d'avis ouvert
  const role: MemberRole | null = tab === "seller" ? "SELLER" : tab === "buyer" ? "BUYER" : null;
  const [eligible, mine, bought] = await Promise.all([
    viewer && role && !isMe ? canMemberReview(viewer.id, member.id, role) : Promise.resolve("no" as const),
    viewer && role && !isMe ? db.memberReview.findUnique({ where: { authorId_targetId_role: { authorId: viewer.id, targetId: member.id, role } } }) : Promise.resolve(null),
    tab === "seller" ? purchasesBetween(sellerReviews.map((r) => ({ buyerId: r.authorId, sellerId: member.id }))) : Promise.resolve(new Map<string, number>()),
  ]);

  const tabLabel = { resources: t.profile.tabResources(resources.length), seller: t.profile.tabSeller(sellerReviews.length), buyer: t.profile.tabBuyer(buyerReviews.length) };
  const reviews = role === "SELLER" ? sellerReviews : buyerReviews;
  const stats = role === "SELLER" ? sellerStats : buyerStats;

  return (
    <div className="container-q pt-6 sm:pt-8">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-5">
          <UserAvatar name={member.username} src={member.avatarUrl} size={96} className="text-4xl" />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="truncate">{member.username}</span>
              {founder && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-text">
                  <Crown className="h-3 w-3" aria-hidden="true" /> {t.profile.founder}
                </span>
              )}
              {isSeller && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-0.5 text-[11px] font-bold text-ok">
                  <Store className="h-3 w-3" aria-hidden="true" /> {t.profile.seller}
                </span>
              )}
            </h1>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden="true" /> {t.profile.memberSince(since)}
              </span>
              {response && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" aria-hidden="true" /> {t.chat.response[response]}
                </span>
              )}
              {online && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-ok">
                  <span className="h-2 w-2 rounded-full bg-ok" aria-hidden="true" /> {t.chat.online}
                </span>
              )}
            </p>
          </div>
          {isMe ? (
            <Link href="/dashboard/settings" className="btn-ghost px-4 py-2.5 text-sm">
              <Settings className="h-4 w-4" aria-hidden="true" /> {t.profile.settings.title}
            </Link>
          ) : (
            <Link href={`/messages/new?to=${encodeURIComponent(member.username)}`} prefetch={false} className="btn-accent rounded-xl px-5 py-2.5 text-sm">
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> {t.profile.contact}
            </Link>
          )}
        </div>

        <div className={`mt-5 grid grid-cols-2 gap-3 ${isSeller ? "lg:grid-cols-4" : ""}`}>
          {isSeller && <Stat value={formatNumber(resources.length, locale)} label={t.profile.statResources} />}
          {isSeller && <Stat value={formatNumber(sales, locale)} label={t.profile.statSales} />}
          {isSeller && <Stat value={sellerStats.rating !== null ? `${formatRating(sellerStats.rating, locale)} ★` : "—"} label={t.profile.statSeller(sellerStats.count)} />}
          <Stat value={buyerStats.rating !== null ? `${formatRating(buyerStats.rating, locale)} ★` : "—"} label={t.profile.statBuyer(buyerStats.count)} />
        </div>

        <nav className="mt-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-surface p-1 [scrollbar-width:none]" aria-label={member.username}>
          {tabs.map((k) => (
            <Link
              key={k}
              href={`/u/${encodeURIComponent(member.username)}${k === tabs[0] ? "" : `?tab=${k}`}`}
              scroll={false}
              aria-current={k === tab ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${k === tab ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"}`}
            >
              {tabLabel[k]}
            </Link>
          ))}
        </nav>

        <div id="avis" className="mt-5 scroll-mt-28">
          {tab === "resources" ? (
            resources.length === 0 ? (
              <p className="text-sm text-muted">{t.profile.noResources}</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {resources.map((r) => (
                  <ResourceCard key={r.id} resource={r} locale={locale} />
                ))}
              </div>
            )
          ) : (
            <ReviewsTab
              role={role!}
              memberName={member.username}
              memberId={member.id}
              reviews={reviews}
              stats={stats}
              bought={bought}
              eligible={eligible}
              mine={mine}
              isMe={isMe}
              viewerId={viewer?.id}
              isAdmin={viewer?.role === "ADMIN"}
              locale={locale}
              t={t}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-bg px-4 py-3">
      <p className="text-xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

// Onglet « Avis vendeur » ou « Avis acheteur » : note moyenne, formulaire (si le visiteur peut noter), liste
function ReviewsTab({
  role,
  memberName,
  memberId,
  reviews,
  stats,
  bought,
  eligible,
  mine,
  isMe,
  viewerId,
  isAdmin,
  locale,
  t,
}: {
  role: MemberRole;
  memberName: string;
  memberId: string;
  reviews: MemberReviewData[];
  stats: { rating: number | null; count: number };
  bought: Map<string, number>;
  eligible: "yes" | "download" | "no";
  mine: { rating: number; body: string | null } | null;
  isMe: boolean;
  viewerId?: string;
  isAdmin: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const seller = role === "SELLER";
  return (
    <>
      {stats.rating !== null && (
        <div className="mb-4 flex items-center gap-4 border-b border-border pb-4">
          <span className="text-4xl font-extrabold tracking-tight">{formatRating(stats.rating, locale)}</span>
          <div>
            <Stars rating={stats.rating} label={t.resource.rating(formatRating(stats.rating, locale))} />
            <p className="text-xs text-muted">{seller ? t.profile.sellerFrom(stats.count) : t.profile.buyerFrom(stats.count)}</p>
          </div>
        </div>
      )}

      {eligible === "yes" && (
        <div className="mb-5">
          <ReviewForm
            initial={mine}
            action={submitMemberReview}
            fields={{ targetId: memberId, role }}
            title={seller ? t.profile.sellerFormTitle(memberName) : t.profile.buyerFormTitle(memberName)}
            placeholder={seller ? t.profile.sellerPlaceholder : t.profile.buyerPlaceholder}
            note={seller ? t.profile.sellerEligible : t.profile.buyerEligible(memberName)}
          />
        </div>
      )}
      {eligible === "download" && seller && <p className="mb-5 rounded-xl bg-bg px-4 py-3 text-sm text-muted">{t.profile.downloadFirst}</p>}

      {reviews.length === 0 ? (
        <p className="text-sm text-muted">{seller ? t.profile.sellerEmpty : t.profile.buyerEmpty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {reviews.map((r) => (
            <MemberReviewItem
              key={r.id}
              review={r}
              targetName={memberName}
              bought={bought.get(r.author.id)}
              canReply={isMe}
              canDelete={isAdmin}
              viewerId={viewerId}
              locale={locale}
              t={t}
            />
          ))}
        </ul>
      )}
    </>
  );
}
