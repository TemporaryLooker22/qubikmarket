import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { LoginForm } from "@/components/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { configuredProviders } from "@/lib/oauth";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.auth.loginTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, { t }, user] = await Promise.all([searchParams, getDictionary(), getCurrentUser()]);
  // Déjà connecté : on renvoie directement là où la personne voulait aller
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/");

  return (
    <AuthLayout title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle} t={t}>
      <LoginForm next={next} providers={configuredProviders()} error={error ? (error === "banned" ? t.errors.banned : (t.auth.oauthErrors[error] ?? t.auth.oauthErrors.oauth_failed)) : undefined} />
    </AuthLayout>
  );
}
