"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { catalogHref, type CatalogFilters } from "@/lib/catalog-filters";
import { useI18n } from "@/lib/i18n/client";

// Prix minimum / maximum : appliqué avec Entrée ou en quittant le champ
export function PriceRange({ filters }: { filters: CatalogFilters }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [min, setMin] = useState(filters.min);
  const [max, setMax] = useState(filters.max);

  // Remet les champs à jour si les filtres changent ailleurs (ex. « Tout effacer »)
  useEffect(() => setMin(filters.min), [filters.min]);
  useEffect(() => setMax(filters.max), [filters.max]);

  const apply = () => {
    if (min === filters.min && max === filters.max) return;
    startTransition(() => router.push(catalogHref(filters, { min, max }), { scroll: false }));
  };

  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border border-border bg-card px-2.5 transition focus-within:border-text">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        placeholder={label}
        value={value}
        onChange={(e) => set(e.target.value)}
        onBlur={apply}
        className="w-full min-w-0 bg-transparent py-2 text-sm outline-none placeholder:text-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <span className="text-xs text-muted">€</span>
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className={`flex items-center gap-2 transition ${pending ? "opacity-60" : ""}`}
    >
      {field(t.catalog.min, min, setMin)}
      <span className="text-muted">–</span>
      {field(t.catalog.max, max, setMax)}
      {/* Bouton invisible : permet de valider avec Entrée */}
      <button type="submit" className="sr-only">
        OK
      </button>
    </form>
  );
}
