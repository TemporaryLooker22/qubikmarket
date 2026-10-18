"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { checkUsername, login, register } from "@/app/actions";
import { useI18n } from "@/lib/i18n/client";
import { SubmitButton } from "./SubmitButton";
import { readVisitSource } from "./SourceTracker";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[15px] outline-none transition placeholder:text-muted focus:border-text focus:ring-4 focus:ring-accent/30";
const submitClass =
  "mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-accent text-[15px] font-semibold text-text transition hover:-translate-y-px hover:bg-accent-hover disabled:translate-y-0 disabled:opacity-60";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <ErrorBox message={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label={t.auth.email}>
        {(id) => <input id={id} name="email" type="email" required autoComplete="email" placeholder={t.auth.emailPh} className={inputClass} />}
      </Field>
      <Field label={t.auth.password}>{(id) => <PasswordInput id={id} name="password" autoComplete="current-password" />}</Field>
      <SubmitButton pendingText={t.auth.loginPending} className={submitClass}>
        {t.auth.loginSubmit}
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        {t.auth.noAccount}{" "}
        <Link href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-text underline decoration-accent decoration-2 underline-offset-4">
          {t.auth.signupLink}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [state, action] = useActionState(register, undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;
  // D'où vient le visiteur (voir SourceTracker) : enregistré avec le compte
  const [source, setSource] = useState("");
  useEffect(() => setSource(readVisitSource()), []);

  return (
    <form action={action} className="space-y-4">
      <ErrorBox message={state?.error} />
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="source" value={source} />

      <Field label={t.auth.username}>{(id) => <UsernameInput id={id} />}</Field>

      <Field label={t.auth.email}>
        {(id) => <input id={id} name="email" type="email" required autoComplete="email" placeholder={t.auth.emailPh} className={inputClass} />}
      </Field>

      <Field label={t.auth.password}>
        {(id) => (
          <>
            <PasswordInput id={id} name="password" autoComplete="new-password" minLength={8} placeholder={t.auth.passwordPh} value={password} onChange={setPassword} />
            <StrengthMeter password={password} />
          </>
        )}
      </Field>

      <Field label={t.auth.confirm}>
        {(id) => (
          <>
            <PasswordInput id={id} name="confirm" autoComplete="new-password" value={confirm} onChange={setConfirm} invalid={mismatch} />
            {mismatch && <p className="mt-1.5 text-xs font-medium text-bad">{t.auth.mismatch}</p>}
          </>
        )}
      </Field>

      <div className="space-y-2.5 pt-1">
        <Checkbox name="age">{t.auth.age}</Checkbox>
        <Checkbox name="terms">
          {t.auth.termsStart}
          <Link href="/terms" target="_blank" className="font-medium text-text underline decoration-accent decoration-2 underline-offset-2">
            {t.auth.termsLink}
          </Link>
          {t.auth.termsAnd}
          <Link href="/privacy" target="_blank" className="font-medium text-text underline decoration-accent decoration-2 underline-offset-2">
            {t.auth.privacyLink}
          </Link>
        </Checkbox>
      </div>

      <SubmitButton pendingText={t.auth.registerPending} className={submitClass}>
        {t.auth.registerSubmit}
      </SubmitButton>
    </form>
  );
}

function Field({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="animate-pop rounded-lg bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
      {message}
    </p>
  );
}

// Champ mot de passe avec l'œil pour afficher / masquer
function PasswordInput({
  id,
  name,
  autoComplete,
  minLength,
  placeholder,
  value,
  onChange,
  invalid,
}: {
  id: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  placeholder?: string;
  value?: string;
  onChange?: (v: string) => void;
  invalid?: boolean;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        aria-invalid={invalid || undefined}
        className={`${inputClass} pr-11 ${invalid ? "border-bad focus:border-bad" : ""}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.auth.hide : t.auth.show}
        className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted transition hover:bg-surface hover:text-text"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Solidité du mot de passe : 0 (trop court) à 4 (solide)
function passwordStrength(pw: string) {
  if (pw.length < 8) return 0;
  let score = 1;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

function StrengthMeter({ password }: { password: string }) {
  const { t } = useI18n();
  if (!password) return null;
  const level = passwordStrength(password);
  // Gris → jaune → vert
  const color = level === 0 ? "bg-bad" : level <= 2 ? "bg-accent" : "bg-ok";
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= Math.max(level, 1) ? color : "bg-surface-2"}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{t.auth.strengthLabel(t.auth.strength[level])}</p>
    </div>
  );
}

// Pseudo avec vérification « disponible / déjà pris » pendant la frappe
function UsernameInput({ id }: { id: string }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

  useEffect(() => {
    const name = value.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(name)) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    let cancelled = false;
    // On attend que la personne arrête de taper avant de demander au serveur
    const timer = setTimeout(async () => {
      const free = await checkUsername(name).catch(() => null);
      if (!cancelled && free !== null) setStatus(free ? "available" : "taken");
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <div className="relative">
      <input
        id={id}
        name="username"
        required
        minLength={3}
        maxLength={20}
        pattern="[a-zA-Z0-9_]+"
        autoComplete="username"
        placeholder={t.auth.usernamePh}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={status === "taken" || undefined}
        className={`${inputClass} pr-32 ${status === "taken" ? "border-bad focus:border-bad" : ""}`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs font-medium" aria-live="polite">
        {status === "checking" && (
          <span className="flex items-center gap-1 text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.auth.checking}
          </span>
        )}
        {status === "available" && (
          <span className="flex items-center gap-1 text-ok">
            <Check className="h-3.5 w-3.5" /> {t.auth.available}
          </span>
        )}
        {status === "taken" && (
          <span className="flex items-center gap-1 text-bad">
            <X className="h-3.5 w-3.5" /> {t.auth.taken}
          </span>
        )}
      </span>
    </div>
  );
}

function Checkbox({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
      <input type="checkbox" name={name} required className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#0b0b0b]" />
      <span>{children}</span>
    </label>
  );
}
