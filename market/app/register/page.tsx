import { RegisterForm } from "@/components/AuthForms";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.auth.registerTitle };
}

export default async function RegisterPage() {
  const { t } = await getDictionary();
  return (
    <>
      <h1>{t.auth.registerTitle}</h1>
      <RegisterForm />
    </>
  );
}
