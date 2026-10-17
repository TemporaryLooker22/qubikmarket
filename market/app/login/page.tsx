import { LoginForm } from "@/components/AuthForms";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.auth.loginTitle };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, { t }] = await Promise.all([searchParams, getDictionary()]);
  return (
    <>
      <h1>{t.auth.loginTitle}</h1>
      <LoginForm next={next} />
    </>
  );
}
