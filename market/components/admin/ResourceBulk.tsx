"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type Action = (formData: FormData) => Promise<void>;
type BoundAction = () => Promise<void>;

// Barre des actions groupées (Modération → Ressources) : compte les ressources cochées dans le formulaire
// et propose de les retirer, de les remettre en vente ou de relancer l'IA d'un coup.
export function BulkBar({ unlist, relist, reanalyze }: { unlist: Action; relist: Action; reanalyze: Action }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const update = () => setCount(form.querySelectorAll('input[name="ids"]:checked').length);
    form.addEventListener("change", update);
    return () => form.removeEventListener("change", update);
  }, []);

  const button = "rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold transition hover:border-text disabled:opacity-50";
  return (
    <div ref={ref} className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
      <span className="mr-auto font-medium">{count > 0 ? t.mod.selected(count) : <span className="text-muted">{t.mod.bulkHint}</span>}</span>
      <button formAction={unlist} disabled={count === 0} className={button}>
        {t.admin.unlist}
      </button>
      <button formAction={relist} disabled={count === 0} className={button}>
        {t.mod.relist}
      </button>
      <button formAction={reanalyze} disabled={count === 0} className={button}>
        {t.mod.reanalyze}
      </button>
    </div>
  );
}

// Case « tout cocher » de l'en-tête
export function SelectAll({ label }: { label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 accent-[var(--color-text)]"
      onChange={(e) => {
        const form = e.currentTarget.closest("form");
        form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => (box.checked = e.currentTarget.checked));
        form?.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    />
  );
}

// Bouton qui demande confirmation avant d'envoyer (suppression définitive)
export function ConfirmButton({ action, confirm, children, className }: { action: BoundAction; confirm: string; children: React.ReactNode; className: string }) {
  return (
    <button
      formAction={action}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
