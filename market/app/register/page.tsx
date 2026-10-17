import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { RegisterForm } from "@/components/AuthForms";
import { AuthLayout } from "@/components/auth/AuthLayout";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.auth.registerTitle };
}

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, { t }, user] = await Promise.all([searchParams, getDictionary(), getCurrentUser()]);
  // Déjà connecté : pas besoin de s'inscrire
  if (user) redirect("/");

  return (
    <AuthLayout
      title={t.auth.registerTitle}
      t={t}
      subtitle={
        <>
          {t.auth.hasAccount}{" "}
          <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-text underline decoration-accent decoration-2 underline-offset-4">
            {t.auth.loginLink}
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
    </AuthLayout>
  );
}
