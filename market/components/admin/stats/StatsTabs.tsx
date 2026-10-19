"use client";

import { useState } from "react";

// Carte avec des petits onglets (Pages : les plus vues / d'entrée / de sortie…), contenus préparés côté serveur
export function StatsTabs({ title, tabs, className = "" }: { title: string; tabs: { label: string; content: React.ReactNode }[]; className?: string }) {
  const [active, setActive] = useState(0);
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {tabs.length > 1 && (
          <div role="tablist" className="flex flex-wrap gap-1">
            {tabs.map((tab, i) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${i === active ? "bg-surface text-text" : "text-muted hover:text-text"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {tabs[active]?.content}
    </section>
  );
}
