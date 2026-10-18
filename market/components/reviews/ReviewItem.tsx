import Link from "next/link";
import { BadgeCheck, CornerDownRight, Trash2 } from "lucide-react";
import { deleteReview } from "@/app/review-actions";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { formatDate } from "@/lib/i18n/format";
import { Stars } from "@/components/Stars";
import { ReplyForm } from "./ReplyForm";
import { ReportButton } from "./ReportButton";

export type ReviewData = {
  id: string;
  userId?: string;
  rating: number;
  body: string | null;
  version: string;
  reply: string | null;
  createdAt: Date;
  user: { username: string };
  resource?: { title: string; slug: string }; // Mon espace : la ressource concernée
};

// Un avis : auteur, étoiles, date, version, commentaire et réponse du vendeur.
// canReply : le vendeur peut répondre ; canDelete : un modérateur peut supprimer l'avis ;
// viewerId : le membre connecté, qui peut signaler l'avis (sauf le sien).
export function ReviewItem({
  review,
  sellerName,
  canReply = false,
  canDelete = false,
  viewerId,
  locale,
  t,
}: {
  review: ReviewData;
  sellerName: string;
  canReply?: boolean;
  canDelete?: boolean;
  viewerId?: string;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-text text-[13px] font-bold uppercase text-bg">{review.user.username.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{review.user.username}</span>
            {review.resource ? (
              <span className="text-sm text-muted">
                {t.reviews.on}{" "}
                <Link href={`/resources/${review.resource.slug}#avis`} className="font-medium text-text underline-offset-2 hover:underline">
                  {review.resource.title}
                </Link>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-px text-[11px] font-bold text-ok">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                {t.reviews.verified}
              </span>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <Stars rating={review.rating} label={t.resource.rating(String(review.rating))} className="h-3.5 w-3.5" />
            <span>
              · {formatDate(review.createdAt, locale)} · v{review.version}
            </span>
          </p>
          {review.body && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed">{review.body}</p>}

          {review.reply && (
            <div className="mt-2.5 rounded-xl bg-bg px-3.5 py-2.5 text-sm">
              <p className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold">
                <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                {t.reviews.sellerReply(sellerName)}
              </p>
              <p className="whitespace-pre-line">{review.reply}</p>
            </div>
          )}
          {canReply && (
            <div className="mt-2.5">
              <ReplyForm key={review.reply ?? ""} reviewId={review.id} initial={review.reply} />
            </div>
          )}
          {viewerId && review.userId && viewerId !== review.userId && (
            <div className="mt-2">
              <ReportButton reviewId={review.id} />
            </div>
          )}
          {canDelete && (
            <form action={deleteReview} className="mt-2">
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
