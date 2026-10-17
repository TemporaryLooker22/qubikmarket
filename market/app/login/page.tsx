import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { LoginForm } from "@/components/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.auth.loginTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, { t }, user] = await Promise.all([searchParams, getDictionary(), getCurrentUser()]);
  // Déjà connecté : on renvoie directement là où la personne voulait aller
  if (user) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/");

  return (
    <AuthLayout title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle} t={t}>
      <LoginForm next={next} />
    </AuthLayout>
  );
}
