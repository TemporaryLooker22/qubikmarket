"use client";

import { useActionState } from "react";
import { publishResource } from "@/app/actions";
import { ALLOWED_EXTENSIONS, CATEGORIES } from "@/lib/catalog";
import { SubmitButton } from "./SubmitButton";

export function SellForm() {
  const [state, action] = useActionState(publishResource, undefined);

  return (
    <form action={action}>
      {state?.error && <p role="alert">{state.error}</p>}

      <p>
        <label htmlFor="title">Titre</label>
        <br />
        <input id="title" name="title" required maxLength={80} placeholder="Système d'inventaire complet" />
      </p>

      <p>
        <label htmlFor="summary">Résumé (une phrase)</label>
        <br />
        <input id="summary" name="summary" required maxLength={160} placeholder="Inventaire drag & drop avec sauvegarde DataStore" />
      </p>

      <p>
        <label htmlFor="description">Description</label>
        <br />
        <textarea id="description" name="description" required rows={7} placeholder="Fonctionnalités, installation, ce qui est inclus…" />
      </p>

      <p>
        <label htmlFor="category">Catégorie</label>
        <br />
        <select id="category" name="category" required defaultValue="">
          <option value="" disabled>Choisir…</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </p>

      <p>
        <label htmlFor="price">Prix (€) — 0 = gratuit. Qubik prend 10 % de commission.</label>
        <br />
        <input id="price" name="price" type="number" min={0} max={500} step="0.01" defaultValue={0} required />
      </p>

      <p>
        <label htmlFor="file">Fichier ({ALLOWED_EXTENSIONS.join(", ")} · 4 Mo maximum)</label>
        <br />
        <input id="file" name="file" type="file" required accept={ALLOWED_EXTENSIONS.join(",")} />
      </p>

      <p>Que se passe-t-il ensuite ?</p>
      <ul>
        <li>Scan propre : ta ressource est en ligne immédiatement.</li>
        <li>Scan à vérifier : un modérateur la relit avant publication.</li>
        <li>Scan dangereux : refus automatique, avec le rapport pour corriger.</li>
      </ul>

      <SubmitButton pendingText="Scan en cours…">Publier</SubmitButton>
    </form>
  );
}
