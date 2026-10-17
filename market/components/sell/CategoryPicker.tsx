"use client";

import { CATEGORIES } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { CategoryIcon } from "@/components/CategoryIcon";

// Choix de la catégorie en tuiles (mise en vente et modification d'une ressource)
export function CategoryPicker({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{t.sell.fCategory}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CATEGORIES.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30 ${
              value === c.id ? "border-text bg-accent-soft ring-1 ring-text ring-inset" : "border-border bg-card hover:border-border-strong"
            }`}
          >
            <input type="radio" name="category" value={c.id} checked={value === c.id} onChange={() => onChange(c.id)} className="sr-only" />
            <CategoryIcon category={c.id} className="h-4 w-4 shrink-0" />
            <span className="truncate">{c.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
