"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";
import { SubmitButton } from "./SubmitButton";

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert">{message}</p>;
}

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action}>
      <ErrorBox message={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <p>
        <label htmlFor="email">{t.auth.email}</label>
        <br />
        <input id="email" name="email" type="email" required autoComplete="email" />
      </p>
      <p>
        <label htmlFor="password">{t.auth.password}</label>
        <br />
        <input id="password" name="password" type="password" required autoComplete="current-password" />
      </p>
      <SubmitButton pendingText={t.auth.loginPending}>{t.auth.loginSubmit}</SubmitButton>
      <p>
        {t.auth.noAccount} <Link href="/register">{t.auth.signupLink}</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const { t } = useI18n();
  const [state, action] = useActionState(register, undefined);
  return (
    <form action={action}>
      <ErrorBox message={state?.error} />
      <p>
        <label htmlFor="username">{t.auth.username}</label>
        <br />
        <input id="username" name="username" required minLength={3} maxLength={20} placeholder={t.auth.usernamePh} />
      </p>
      <p>
        <label htmlFor="email">{t.auth.email}</label>
        <br />
        <input id="email" name="email" type="email" required autoComplete="email" />
      </p>
      <p>
        <label htmlFor="password">{t.auth.passwordNew}</label>
        <br />
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
      </p>
      <SubmitButton pendingText={t.auth.registerPending}>{t.auth.registerSubmit}</SubmitButton>
      <p>
        {t.auth.hasAccount} <Link href="/login">{t.auth.loginLink}</Link>
      </p>
    </form>
  );
}
