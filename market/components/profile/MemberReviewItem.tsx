import Link from "next/link";
import { BadgeCheck, CornerDownRight, Store, Trash2 } from "lucide-react";
import { deleteMemberReview, replyToMemberReview, reportMemberReview } from "@/app/member-actions";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { formatDate } from "@/lib/i18n/format";
import { links } from "@/lib/notifications";
import { Stars } from "@/components/Stars";
import { UserAvatar } from "@/components/UserAvatar";
import { ReplyForm } from "@/components/reviews/ReplyForm";
import { ReportButton } from "@/components/reviews/ReportButton";

export type MemberReviewData = {
  id: string;
  role: string;
  rating: number;
  body: string | null;
  reply: string | null;
  createdAt: Date;
  author: { id: string; username: string; avatarUrl: string | null };
};

// Un avis sur un membre (profil) : auteur, badge, étoiles, texte et réponse du membre noté.
// bought : nombre d'achats de l'auteur chez ce vendeur (avis vendeur) ; canReply : le membre noté ;
// viewerId : peut signaler (sauf son propre avis) ; canDelete : modérateur.
export function MemberReviewItem({
  review,
  targetName,
  bought,
  canReply,
  canDelete,
  viewerId,
  locale,
  t,
}: {
  review: MemberReviewData;
  targetName: string;
  bought?: number;
  canReply: boolean;
  canDelete: boolean;
  viewerId?: string;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <Link href={links.profile(review.author.username)}>
          <UserAvatar name={review.author.username} src={review.author.avatarUrl} size={32} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={links.profile(review.author.username)} className="font-semibold hover:underline">
              {review.author.username}
            </Link>
            {review.role === "SELLER" ? (
              bought ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-px text-[11px] font-bold text-ok">
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                  {t.profile.bought(bought)}
                </span>
              ) : null
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-px text-[11px] font-bold">
                <Store className="h-3 w-3" aria-hidden="true" />
                {t.profile.seller}
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <Stars rating={review.rating} label={t.resource.rating(String(review.rating))} className="h-3.5 w-3.5" />
            <span>· {formatDate(review.createdAt, locale)}</span>
          </p>
          {review.body && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{review.body}</p>}

          {review.reply && (
            <div className="mt-2.5 rounded-xl bg-bg px-3.5 py-2.5 text-sm">
              <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold">
                <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                {t.profile.replyOf(targetName)}
              </p>
              <p className="whitespace-pre-line">{review.reply}</p>
            </div>
          )}
          {canReply && (
            <div className="mt-2.5">
              <ReplyForm key={review.reply ?? ""} reviewId={review.id} initial={review.reply} action={replyToMemberReview} />
            </div>
          )}
          {viewerId && viewerId !== review.author.id && (
            <div className="mt-2">
              <ReportButton reviewId={review.id} action={reportMemberReview} />
            </div>
          )}
          {canDelete && (
            <form action={deleteMemberReview} className="mt-2">
              <input type="hidden" name="reviewId" value={review.id} />
              <button className="inline-flex items-center gap-1 text-xs font-semibold text-bad hover:underline">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t.reviews.delete}
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
