"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { CATEGORIES } from "@/lib/catalog";
import { createProjectRequest } from "@/app/project-actions";
import { inputClass } from "@/components/edit/EditForms";

// Formulaire « Publier une demande » des projets sur mesure
export function RequestForm() {
  const { t } = useI18n();
  const s = t.projects;
  const [state, action, pending] = useActionState(createProjectRequest, undefined);
  const label = "mb-1.5 block text-sm font-semibold";
  return (
    <form action={action} className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div>
        <label htmlFor="title" className={label}>{s.titleLabel}</label>
        <input id="title" name="title" required minLength={6} maxLength={90} placeholder={s.titlePh} className={inputClass} />
      </div>
      <div>
        <label htmlFor="description" className={label}>{s.descLabel}</label>
        <textarea id="description" name="description" required minLength={40} maxLength={5000} rows={7} placeholder={s.descPh} className={`${inputClass} h-auto py-2.5`} />
      </div>
      <div>
        <label htmlFor="category" className={label}>{s.categoryLabel}</label>
        <select id="category" name="category" required defaultValue="" className={inputClass}>
          <option value="" disabled>—</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="budget" className={label}>{s.budgetLabel}</label>
          <input id="budget" name="budget" type="number" required min={5} max={500} step="0.01" inputMode="decimal" className={inputClass} />
          <p className="mt-1 text-xs text-muted">{s.budgetHelp}</p>
        </div>
        <div>
          <label htmlFor="deadline" className={label}>{s.deadlineLabel}</label>
          <input id="deadline" name="deadline" type="number" min={1} max={90} step={1} className={inputClass} />
        </div>
      </div>
      {state?.error && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">{state.error}</p>}
      <button disabled={pending} className="btn-accent h-11 w-full justify-center rounded-xl text-sm disabled:opacity-60 sm:w-auto sm:px-6">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        {s.submitRequest}
      </button>
    </form>
  );
}
