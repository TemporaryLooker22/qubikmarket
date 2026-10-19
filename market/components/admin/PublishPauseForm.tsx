"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { pausePublishing } from "@/app/moderation-actions";

const MODES = ["1d", "2d", "7d", "30d", "custom", "indefinite"] as const;

// Modération → Utilisateurs : mettre en pause les publications d'un membre (durée, date choisie ou jusqu'à nouvel ordre)
export function PublishPauseForm({ userId, defaultUntil }: { userId: string; defaultUntil: string }) {
  const { t } = useI18n();
  const s = t.publishPause;
  const [mode, setMode] = useState<(typeof MODES)[number]>("2d");
  const field = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-text";
  return (
    <form action={pausePublishing} className="space-y-2.5">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="mode" value={mode} />
      <p className="text-sm font-semibold">{s.pauseTitle}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={s.pauseTitle}>
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${mode === m ? "border-text bg-text text-bg" : "border-border hover:border-border-strong"}`}
          >
            {s.modes[m]}
          </button>
        ))}
      </div>
      {mode === "custom" && (
        <label className="block text-xs font-semibold text-muted">
          {s.untilLabel}
          <input type="datetime-local" name="until" required defaultValue={defaultUntil} className={`${field} mt-1`} />
        </label>
      )}
      <textarea name="reason" rows={2} maxLength={300} placeholder={s.reasonPh} className={`${field} resize-y`} />
      <div className="flex justify-end">
        <button className="btn-ghost px-4 py-2 text-sm">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {s.pause}
        </button>
      </div>
    </form>
  );
}
