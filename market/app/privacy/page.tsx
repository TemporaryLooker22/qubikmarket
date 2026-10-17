import { getDictionary } from "@/lib/i18n/server";
import { getLegal } from "@/lib/legal";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata() {
  const { locale } = await getDictionary();
  return { title: getLegal("privacy", locale).title };
}

export default function PrivacyPage() {
  return <LegalPage doc="privacy" />;
}
