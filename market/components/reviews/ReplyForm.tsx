"use client";

import { useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { replyToReview } from "@/app/review-actions";
import { useI18n } from "@/lib/i18n/client";

// Réponse publique du vendeur à un avis (page de la ressource et Mon espace).
// Déjà répondu : un bouton « Modifier la réponse » rouvre le champ (vider le champ retire la réponse).
export function ReplyForm({ reviewId, initial }: { reviewId: string; initial: string | null }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(replyToReview, undefined);
  const [open, setOpen] = useState(!initial);
  const [reply, setReply] = useState(initial ?? "");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-muted underline-offset-2 hover:text-text hover:underline">
        {t.reviews.editReply}
      </button>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="reviewId" value={reviewId} />
      <textarea
        name="reply"
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder={t.reviews.replyPlaceholder}
        className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-text focus:ring-4 focus:ring-accent/30"
      />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
        {state?.error && (
          <p role="alert" className="mr-auto text-sm font-medium text-bad">
            {state.error}
          </p>
        )}
        {state?.ok && !pending && (
          <p role="status" className="mr-auto flex items-center gap-1.5 text-sm font-medium text-ok">
            <Check className="h-4 w-4" aria-hidden="true" />
            {state.ok}
          </p>
        )}
        <button type="submit" disabled={pending || (!reply.trim() && !initial)} className="btn-accent rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {t.reviews.reply}
        </button>
      </div>
    </form>
  );
}
