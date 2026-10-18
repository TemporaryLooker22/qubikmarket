"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

type Choice = { value: string; label: string; tone: "approve" | "reject" };

// Bloc « Ta décision » de la modération : motifs rapides (ils préremplissent la note au vendeur, modifiable),
// note, et les deux boutons (Approuver / Refuser, ou C'est bon / Retirer de la vente).
export function DecisionForm({
  action,
  hidden,
  choices,
  sticky = false,
}: {
  action: (formData: FormData) => Promise<void>;
  hidden: Record<string, string>;
  choices: [Choice, Choice];
  sticky?: boolean;
}) {
  const { t } = useI18n();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState<number | null>(null);

  return (
    <form
      action={action}
      className={`rounded-2xl border border-border bg-card p-4 ${sticky ? "sticky bottom-3 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.3)]" : ""}`}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="mb-2 text-sm font-semibold">{t.mod.decision}</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {t.mod.reasons.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onClick={() => {
              setReason(i);
              setNote(r.text);
            }}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              reason === i ? "border-text bg-surface" : "border-dashed border-border-strong text-muted hover:text-text"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <textarea
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder={t.mod.notePh}
        className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-text focus:ring-4 focus:ring-accent/30"
      />
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto text-xs text-muted">{t.mod.decisionNote}</p>
        {[...choices].reverse().map((c) => (
          <ChoiceButton key={c.value} choice={c} />
        ))}
      </div>
    </form>
  );
}

function ChoiceButton({ choice }: { choice: Choice }) {
  const { pending } = useFormStatus();
  const reject = choice.tone === "reject";
  return (
    <button
      name="decision"
      value={choice.value}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
        reject ? "bg-bad text-white hover:opacity-90" : "bg-accent text-text hover:bg-accent-hover"
      }`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : reject ? <X className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
      {choice.label}
    </button>
  );
}
