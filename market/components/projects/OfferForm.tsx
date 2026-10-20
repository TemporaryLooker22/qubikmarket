"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { submitProjectOffer } from "@/app/project-actions";
import { inputClass } from "@/components/edit/EditForms";

// Offre d'un développeur sur une demande (envoi ou modification)
export function OfferForm({ requestId, feePercent, initial }: { requestId: string; feePercent: number; initial?: { price: number; days: number; message: string } }) {
  const { t } = useI18n();
  const s = t.projects;
  const [state, action, pending] = useActionState(submitProjectOffer, undefined);
  const label = "mb-1.5 block text-sm font-semibold";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="price" className={label}>{s.priceLabel}</label>
          <input id="price" name="price" type="number" required min={5} max={500} step="0.01" inputMode="decimal" defaultValue={initial?.price} className={inputClass} />
        </div>
        <div>
          <label htmlFor="days" className={label}>{s.daysLabel}</label>
          <input id="days" name="days" type="number" required min={1} max={90} step={1} defaultValue={initial?.days} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="message" className={label}>{s.messageLabel}</label>
        <textarea id="message" name="message" required minLength={20} maxLength={3000} rows={5} placeholder={s.messagePh} defaultValue={initial?.message} className={`${inputClass} h-auto py-2.5`} />
      </div>
      <p className="text-xs text-muted">{s.offerFee(feePercent)}</p>
      {state?.error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">{state.error}</p>}
      {state?.ok && <p className="rounded-lg bg-ok-bg px-3 py-2 text-sm font-semibold text-ok">{s.offerSaved}</p>}
      <button disabled={pending} className="btn-accent h-11 w-full justify-center rounded-xl text-sm disabled:opacity-60 sm:w-auto sm:px-6">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {initial ? s.updateOffer : s.sendOffer}
      </button>
    </form>
  );
}
