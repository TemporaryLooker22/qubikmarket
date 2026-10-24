"use client";

import { useActionState } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { ownerCashout } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";

// « Encaisser maintenant » (propriétaire du site uniquement) : versement immédiat des gains disponibles
export function CashoutButton() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(ownerCashout, undefined);
  return (
    <form action={action} className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <p className="min-w-56 flex-1 text-sm text-muted">{t.dashboard.payouts.cashoutHelp}</p>
      <button type="submit" disabled={pending} className="btn-accent rounded-xl px-4 py-2.5">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Banknote className="h-4 w-4" aria-hidden="true" />}
        {pending ? t.dashboard.payouts.cashoutPending : t.dashboard.payouts.cashoutButton}
      </button>
      {state?.error && (
        <p role="alert" className="animate-pop w-full rounded-lg bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="animate-pop w-full rounded-lg bg-ok-bg px-3.5 py-2.5 text-sm font-medium text-ok">
          {state.ok}
        </p>
      )}
    </form>
  );
}
