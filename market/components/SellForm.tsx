"use client";

import { useActionState } from "react";
import { publishResource } from "@/app/actions";
import { ALLOWED_EXTENSIONS, CATEGORIES } from "@/lib/catalog";
import { SubmitButton } from "./SubmitButton";

export function SellForm() {
  const [state, action] = useActionState(publishResource, undefined);

  return (
    <form action={action} className="space-y-5">
      {state?.error && <p className="rounded-lg bg-bad-bg p-3 text-sm text-bad">{state.error}</p>}

      <div>
        <label className="label" htmlFor="title">Titre</label>
        <input id="title" name="title" required maxLength={80} className="input" placeholder="Système d'inventaire complet" />
      </div>

      <div>
        <label className="label" htmlFor="summary">Résumé (une phrase)</label>
        <input id="summary" name="summary" required maxLength={160} className="input" placeholder="Inventaire drag & drop avec sauvegarde DataStore" />
      </div>

      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea id="description" name="description" required rows={7} className="input" placeholder="Fonctionnalités, installation, ce qui est inclus…" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category">Catégorie</label>
          <select id="category" name="category" required className="input" defaultValue="">
            <option value="" disabled>Choisir…</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="price">Prix (€)</label>
          <input id="price" name="price" type="number" min={0} max={500} step="0.01" defaultValue={0} required className="input" />
          <p className="mt-1 text-xs text-muted">0 = gratuit. Qubik prend 10 % de commission.</p>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="file">Fichier</label>
        <input id="file" name="file" type="file" required accept={ALLOWED_EXTENSIONS.join(",")} className="input file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-text" />
        <p className="mt-1 text-xs text-muted">{ALLOWED_EXTENSIONS.join(", ")} · 20 Mo maximum</p>
      </div>

      <div className="rounded-xl border border-border bg-bg p-4 text-sm text-muted">
        <p className="font-semibold text-text">Que se passe-t-il ensuite ?</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><span className="text-ok">Scan propre</span> : ta ressource est en ligne immédiatement.</li>
          <li><span className="text-warn">Scan à vérifier</span> : un modérateur la relit avant publication.</li>
          <li><span className="text-bad">Scan dangereux</span> : refus automatique, avec le rapport pour corriger.</li>
        </ul>
      </div>

      <SubmitButton pendingText="Scan en cours…">Publier</SubmitButton>
    </form>
  );
}
