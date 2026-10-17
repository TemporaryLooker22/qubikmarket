import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { SellForm } from "@/components/SellForm";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.sell.title };
}

export default async function SellPage() {
  await requireUser();
  const { t } = await getDictionary();
  return (
    <>
      <h1>{t.sell.title}</h1>
      <p>{t.sell.intro}</p>
      <SellForm />
    </>
  );
}
