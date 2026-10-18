import { AlertTriangle, CheckCircle2, Landmark, PiggyBank, Store } from "lucide-react";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { formatAmount } from "@/lib/i18n/format";
import type { PlatformBalance } from "@/lib/platform-balance";
import { Panel, Stat } from "./AdminUi";

// Modération → Vue d'ensemble : solde Stripe, part des vendeurs et ce qu'on peut retirer sans risque
export function StripeBalancePanel({ data, t, locale }: { data: PlatformBalance; t: Dictionary; locale: Locale }) {
  const m = t.mod;
  const money = (cents: number) => formatAmount(cents, locale);
  const s = data.stripe;
  const settings = (
    <a href="https://dashboard.stripe.com/settings/payouts" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:underline">
      {m.stripeSettings} ↗
    </a>
  );

  if (!s) {
    return (
      <Panel title={m.stripeTitle} className="mb-4">
        <p className="text-sm text-muted">{m.stripeOff}</p>
      </Panel>
    );
  }

  // Alerte la plus importante d'abord : argent manquant, puis virements automatiques vers la banque
  const auto = s.payoutInterval && s.payoutInterval !== "manual";
  const alert = s.missingCents > 0
    ? { bad: true, text: m.stripeMissing(money(s.missingCents)) }
    : auto
      ? { bad: true, text: m.stripeAuto(m.stripeIntervals[s.payoutInterval!] ?? s.payoutInterval!) }
      : s.payoutInterval === "manual"
        ? { bad: false, text: m.stripeManual }
        : { bad: true, text: m.stripeUnknown };

  return (
    <Panel title={m.stripeTitle} className="mb-4" aside={settings}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Landmark} label={m.stripeBalance} value={money(s.availableCents + s.pendingCents)} note={m.stripeBalanceNote(money(s.availableCents), money(s.pendingCents))} />
        <Stat
          icon={Store}
          label={m.stripeReserved}
          value={money(data.reservedCents)}
          note={m.stripeReservedNote(data.reservedSellers, data.noAccountCents > 0 ? money(data.noAccountCents) : null)}
        />
        <Stat dark icon={PiggyBank} label={m.stripeSafe} value={money(s.safeCents)} note={s.upcomingCents > 0 ? m.stripeUpcoming(money(s.upcomingCents)) : m.stripeSafeNote} />
      </div>
      <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${alert.bad ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok"}`}>
        {alert.bad ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
        <span className="font-semibold">{alert.text}</span>
      </p>
      <p className="mt-3 text-xs text-muted">{m.stripeExplain}</p>
    </Panel>
  );
}
