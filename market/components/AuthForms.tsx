"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert">{message}</p>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action}>
      <ErrorBox message={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <p>
        <label htmlFor="email">Email</label>
        <br />
        <input id="email" name="email" type="email" required autoComplete="email" />
      </p>
      <p>
        <label htmlFor="password">Mot de passe</label>
        <br />
        <input id="password" name="password" type="password" required autoComplete="current-password" />
      </p>
      <SubmitButton pendingText="Connexion…">Se connecter</SubmitButton>
      <p>
        Pas encore de compte ? <Link href="/register">Inscris-toi</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action}>
      <ErrorBox message={state?.error} />
      <p>
        <label htmlFor="username">Pseudo</label>
        <br />
        <input id="username" name="username" required minLength={3} maxLength={20} placeholder="Ton pseudo Roblox, par exemple" />
      </p>
      <p>
        <label htmlFor="email">Email</label>
        <br />
        <input id="email" name="email" type="email" required autoComplete="email" />
      </p>
      <p>
        <label htmlFor="password">Mot de passe (8 caractères minimum)</label>
        <br />
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </p>
      <SubmitButton pendingText="Création…">Créer mon compte</SubmitButton>
      <p>
        Déjà inscrit ? <Link href="/login">Connecte-toi</Link>
      </p>
    </form>
  );
}
