"use client";

import { useActionState, useState } from "react";
import { Check, Flag } from "lucide-react";
import { reportReview, type ReviewState } from "@/app/review-actions";
import { useI18n } from "@/lib/i18n/client";

// Petit lien « Signaler » sous un avis : ouvre un champ pour la raison (facultative), puis envoie aux modérateurs
// action : signalement d'un avis sur un membre (profil) au lieu d'un avis de ressource
export function ReportButton({ reviewId, action = reportReview }: { reviewId: string; action?: (state: ReviewState, formData: FormData) => Promise<ReviewState> }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, undefined);
  const [open, setOpen] = useState(false);

  if (state?.ok) {
    return (
      <p role="status" className="flex items-center gap-1 text-xs font-medium text-ok">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {state.ok}
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-text">
        <Flag className="h-3 w-3" aria-hidden="true" />
        {t.reviews.report}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input
        name="reason"
        maxLength={300}
        autoFocus
        placeholder={t.reviews.reportPlaceholder}
        className="h-8 min-w-48 flex-1 rounded-lg border border-border bg-card px-2.5 text-xs outline-none focus:border-text"
      />
      <button type="submit" disabled={pending} className="h-8 rounded-lg bg-text px-3 text-xs font-semibold text-bg disabled:opacity-60">
        {t.reviews.reportSend}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-text">
        {t.reviews.cancel}
      </button>
      {state?.error && <p className="w-full text-xs text-bad">{state.error}</p>}
    </form>
  );
}
