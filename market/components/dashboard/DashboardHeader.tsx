import Link from "next/link";
import { Plus } from "lucide-react";

// En-tête de chaque onglet de « Mon espace » : titre, phrase d'intro et bouton « Nouvelle ressource »
export function DashboardHeader({ title, intro, newResource }: { title: string; intro?: string; newResource?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {intro && <p className="mt-1 text-muted">{intro}</p>}
      </div>
      {newResource && (
        <Link href="/sell" className="btn-accent rounded-xl px-4 py-2.5">
          <Plus className="h-4 w-4" aria-hidden="true" />
          {newResource}
        </Link>
      )}
    </div>
  );
}
