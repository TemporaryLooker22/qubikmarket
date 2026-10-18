"use client";

import { useEffect, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";

// Menu « ⋯ » d'une ligne (Mes ressources). Le contenu (liens, formulaires) est fourni par la page.
// Se ferme au clic à l'extérieur, avec Échap, ou après le choix d'une action.
export function RowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-surface ${open ? "bg-surface" : ""}`}
      >
        <Ellipsis className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          // Lien ou bouton d'action (actions de la modération) : on ferme le menu une fois le clic parti
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("a")) setOpen(false);
            else if (target.closest("button:not([type=button])")) setTimeout(() => setOpen(false));
          }}
          // Formulaire (retirer de la vente…) : on ferme seulement une fois l'envoi parti
          onSubmit={() => setTimeout(() => setOpen(false))}
          className="animate-pop absolute right-0 top-9 z-20 w-60 rounded-xl border border-border bg-card p-1.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]"
        >
          {children}
        </div>
      )}
    </div>
  );
}
