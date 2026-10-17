import { getDictionary } from "@/lib/i18n/server";
import { getLegal } from "@/lib/legal";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata() {
  const { locale } = await getDictionary();
  return { title: getLegal("terms", locale).title };
}

export default function TermsPage() {
  return <LegalPage doc="terms" />;
}
