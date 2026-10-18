import Link from "next/link";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { REPORTED_REVIEWS } from "@/lib/moderation";
import { deleteReview, dismissReviewReports } from "@/app/review-actions";
import { deleteMemberReview, dismissMemberReviewReports } from "@/app/member-actions";
import { REPORTED_MEMBER_REVIEWS } from "@/lib/member-reviews";
import { links } from "@/lib/notifications";
import { Stars } from "@/components/Stars";
import { Badge, PageTitle, Panel } from "@/components/admin/AdminUi";

const reviewInclude = {
  user: { select: { id: true, username: true, bannedAt: true } },
  resource: { select: { slug: true, title: true, sellerId: true } },
} as const;

// Modération → Avis : les avis signalés (avec qui les a signalés et pourquoi), puis les derniers avis du site
export default async function AdminReviewsPage() {
  const { locale, t } = await getDictionary();
  const [reported, latest, memberReported] = await Promise.all([
    db.review.findMany({
      where: REPORTED_REVIEWS,
      orderBy: { createdAt: "desc" },
      include: { ...reviewInclude, reports: { where: { dismissedAt: null }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, username: true } } } } },
    }),
    db.review.findMany({ orderBy: { createdAt: "desc" }, take: 30, include: reviewInclude }),
    // Avis sur des membres (profils) signalés
    db.memberReview.findMany({
      where: REPORTED_MEMBER_REVIEWS,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, username: true } },
        target: { select: { username: true } },
        reports: { where: { dismissedAt: null }, orderBy: { createdAt: "asc" }, include: { user: { select: { username: true } } } },
      },
    }),
  ]);

  return (
    <>
      <PageTitle title={t.mod.menu.reviews} intro={t.mod.reviewsIntro} />

      <Panel title={t.mod.reported} aside={reported.length > 0 ? <Badge tone="bad">{reported.length}</Badge> : undefined} className="mb-4">
        {reported.length === 0 ? (
          <p className="text-sm text-muted">{t.mod.noReported}</p>
        ) : (
          <ul className="divide-y divide-border">
            {reported.map((r) => (
              <ReviewRow key={r.id} review={r} locale={locale} t={t}>
                {r.reports.map((rep) => (
                  <p key={rep.id} className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
                    <strong>{t.mod.reportedBy(rep.user.username, rep.user.id === r.resource.sellerId)}</strong>
                    {rep.reason && <> : « {rep.reason} »</>}
                  </p>
                ))}
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <form action={dismissReviewReports}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button className="btn-ghost px-3 py-1.5 text-xs">{t.mod.ignore}</button>
                  </form>
                  <DeleteButton id={r.id} label={t.mod.deleteReview} />
                </div>
              </ReviewRow>
            ))}
          </ul>
        )}
      </Panel>

      {memberReported.length > 0 && (
        <Panel title={t.mod.memberReported} aside={<Badge tone="bad">{memberReported.length}</Badge>} className="mb-4">
          <ul className="divide-y divide-border">
            {memberReported.map((r) => (
              <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm">
                  <Link href={links.profile(r.target.username, r.role as "SELLER" | "BUYER")} className="font-semibold hover:underline">
                    {t.mod.memberReviewOn(r.author.username, r.target.username, r.role)}
                  </Link>{" "}
                  <span className="text-muted">· {formatDate(r.createdAt, locale)}</span>
                </p>
                <Stars rating={r.rating} label={t.resource.rating(String(r.rating))} className="mt-0.5 h-3.5 w-3.5" />
                {r.body && <p className="mt-1 whitespace-pre-line text-sm">{r.body}</p>}
                {r.reports.map((rep) => (
                  <p key={rep.id} className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">
                    <strong>{rep.user.username}</strong>
                    {rep.reason && <> : « {rep.reason} »</>}
                  </p>
                ))}
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <form action={dismissMemberReviewReports}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button className="btn-ghost px-3 py-1.5 text-xs">{t.mod.ignore}</button>
                  </form>
                  <form action={deleteMemberReview}>
                    <input type="hidden" name="reviewId" value={r.id} />
                    <button className="inline-flex items-center gap-1 rounded-lg bg-bad px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.mod.deleteReview}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={t.mod.latestReviews}>
        {latest.length === 0 ? (
          <p className="text-sm text-muted">{t.mod.noReviews}</p>
        ) : (
          <ul className="divide-y divide-border">
            {latest.map((r) => (
              <ReviewRow key={r.id} review={r} locale={locale} t={t} action={<DeleteButton id={r.id} label={t.mod.deleteReview} small />} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

type Row = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: Date;
  user: { id: string; username: string; bannedAt: Date | null };
  resource: { slug: string; title: string };
};

function ReviewRow({ review: r, locale, t, action, children }: { review: Row; locale: Locale; t: Dictionary; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-text text-[13px] font-bold uppercase text-bg">{r.user.username.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <Link href={`/admin/users?id=${r.user.id}`} className="font-semibold hover:underline">
              {r.user.username}
            </Link>{" "}
            {r.user.bannedAt && <Badge tone="bad">{t.mod.banned}</Badge>}{" "}
            <span className="text-muted">
              {t.reviews.on}{" "}
              <Link href={`/resources/${r.resource.slug}#avis`} className="text-text underline-offset-2 hover:underline">
                {r.resource.title}
              </Link>{" "}
              · {formatDate(r.createdAt, locale)}
            </span>
          </p>
          <Stars rating={r.rating} label={t.resource.rating(String(r.rating))} className="mt-0.5 h-3.5 w-3.5" />
          {r.body && <p className="mt-1 whitespace-pre-line text-sm">{r.body}</p>}
          {children}
        </div>
        {action}
      </div>
    </li>
  );
}

function DeleteButton({ id, label, small = false }: { id: string; label: string; small?: boolean }) {
  return (
    <form action={deleteReview} className="shrink-0">
      <input type="hidden" name="reviewId" value={id} />
      <button
        className={`inline-flex items-center gap-1 rounded-lg font-semibold transition ${small ? "px-2 py-1 text-xs text-bad hover:bg-bad-bg" : "bg-bad px-3 py-1.5 text-xs text-white hover:opacity-90"}`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
