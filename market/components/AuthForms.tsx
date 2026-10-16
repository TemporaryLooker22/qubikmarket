"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-lg bg-bad-bg p-3 text-sm text-bad">{message}</p>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <ErrorBox message={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
      </div>
      <SubmitButton pendingText="Connexion…">Se connecter</SubmitButton>
      <p className="text-center text-sm text-muted">
        Pas encore de compte ? <Link href="/register" className="text-accent hover:underline">Inscris-toi</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action} className="space-y-4">
      <ErrorBox message={state?.error} />
      <div>
        <label className="label" htmlFor="username">Pseudo</label>
        <input id="username" name="username" required minLength={3} maxLength={20} className="input" placeholder="Ton pseudo Roblox, par exemple" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" required minLength={8} className="input" autoComplete="new-password" />
        <p className="mt-1 text-xs text-muted">8 caractères minimum.</p>
      </div>
      <SubmitButton pendingText="Création…">Créer mon compte</SubmitButton>
      <p className="text-center text-sm text-muted">
        Déjà inscrit ? <Link href="/login" className="text-accent hover:underline">Connecte-toi</Link>
      </p>
    </form>
  );
}
