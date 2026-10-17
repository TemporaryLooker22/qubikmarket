import { getLegal, LEGAL_UPDATED } from "@/lib/legal";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";
import { Markdown } from "./Markdown";

// Mise en page commune des pages légales (conditions d'utilisation, confidentialité)
export async function LegalPage({ doc }: { doc: "terms" | "privacy" }) {
  const { locale, t } = await getDictionary();
  const { title, body } = getLegal(doc, locale);
  return (
    <div className="full-bleed container-q py-10">
      <article className="animate-fade-up mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mb-8 mt-2 text-sm text-muted">{t.legal.updated(formatDate(LEGAL_UPDATED, locale))}</p>
        <Markdown>{body}</Markdown>
      </article>
    </div>
  );
}
