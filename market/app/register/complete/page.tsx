import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { PENDING_COOKIE, suggestUsername, verify, type OAuthProfile } from "@/lib/oauth";
import { OAuthCompleteForm } from "@/components/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.auth.completeTitle, robots: { index: false } };
}

// Après « Continuer avec Google / Discord » pour un nouveau membre : choix du pseudo (définitif)
export default async function CompleteSignupPage() {
  const [{ t }, user, jar] = await Promise.all([getDictionary(), getCurrentUser(), cookies()]);
  if (user) redirect("/");
  const pending = await verify<OAuthProfile>(jar.get(PENDING_COOKIE)?.value);
  if (!pending) redirect("/register");

  // Pseudo proposé : le nom chez le fournisseur, avec des chiffres s'il est déjà pris
  const base = suggestUsername(pending.name, pending.email);
  let suggested = base;
  for (let i = 0; i < 5; i++) {
    const taken = await db.user.findFirst({ where: { username: { equals: suggested, mode: "insensitive" } }, select: { id: true } });
    if (!taken) break;
    suggested = `${base.slice(0, 16)}${Math.floor(100 + Math.random() * 900)}`;
  }

  const provider = pending.provider === "google" ? "Google" : "Discord";
  return (
    <AuthLayout title={t.auth.completeTitle} subtitle={t.auth.completeSubtitle(provider, pending.email)} t={t}>
      <OAuthCompleteForm suggested={suggested} />
    </AuthLayout>
  );
}
