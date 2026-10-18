"use client";

import { useActionState, useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { submitReview } from "@/app/review-actions";
import { useI18n } from "@/lib/i18n/client";

const MAX = 1000; // même limite que lib/reviews.ts

// Formulaire « Ton avis » de la page d'une ressource : étoiles à cliquer et commentaire facultatif.
// Sert aussi à modifier son avis (déjà rempli).
export function ReviewForm({ resourceId, initial }: { resourceId: string; initial: { rating: number; body: string | null } | null }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(submitReview, undefined);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(initial?.body ?? "");
  const shown = hover || rating;

  return (
    <form action={formAction} className="rounded-xl bg-accent-soft p-4">
      <input type="hidden" name="resourceId" value={resourceId} />
      <input type="hidden" name="rating" value={rating} />
      <p className="font-semibold">{t.reviews.formTitle}</p>

      {/* Étoiles : un clic choisit la note */}
      <div className="mb-3 mt-2 flex gap-1" role="radiogroup" aria-label={t.reviews.formTitle} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t.reviews.star(n)}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            className="rounded-md p-0.5 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-text"
          >
            <Star className={`h-7 w-7 ${n <= shown ? "text-accent" : "text-border-strong"}`} fill={n <= shown ? "currentColor" : "none"} strokeWidth={n <= shown ? 0 : 1.5} aria-hidden="true" />
          </button>
        ))}
      </div>

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={MAX}
        rows={3}
        placeholder={t.reviews.placeholder}
        className="w-full resize-y rounded-lg border border-border bg-card px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-muted focus:border-text focus:ring-4 focus:ring-accent/30"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {state?.error ? (
          <p role="alert" className="text-sm font-medium text-bad">
            {state.error}
          </p>
        ) : state?.ok && !pending ? (
          <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-ok">
            <Check className="h-4 w-4" aria-hidden="true" />
            {state.ok}
          </p>
        ) : (
          <p className="text-xs text-muted">{t.reviews.formNote}</p>
        )}
        <button type="submit" disabled={pending || rating === 0} className="btn-accent rounded-xl px-5 py-2.5 disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? t.reviews.saving : initial ? t.reviews.update : t.reviews.publish}
        </button>
      </div>
    </form>
  );
}
