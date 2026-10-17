"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { startPayoutSetup } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";

// Choix du pays du compte bancaire, puis envoi vers le formulaire d'inscription Stripe
export function PayoutSetupForm({ countries }: { countries: { code: string; name: string }[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(startPayoutSetup, undefined);
  return (
    <form action={action} className="mt-4">
      {state?.error && (
        <p role="alert" className="animate-pop mb-3 rounded-lg bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
          {state.error}
        </p>
      )}
      <label htmlFor="payout-country" className="mb-1.5 block text-sm font-semibold">
        {t.dashboard.payouts.country}
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id="payout-country"
          name="country"
          required
          defaultValue=""
          className="h-11 min-w-56 flex-1 rounded-lg border border-border bg-card px-3 text-[15px] outline-none transition focus:border-text focus:ring-4 focus:ring-accent/30"
        >
          <option value="" disabled>
            {t.dashboard.payouts.countryPh}
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="btn-accent h-11 rounded-xl px-5 disabled:opacity-60">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {pending ? t.dashboard.payouts.setupPending : t.dashboard.payouts.setupButton}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">{t.dashboard.payouts.countryMissing}</p>
    </form>
  );
}
