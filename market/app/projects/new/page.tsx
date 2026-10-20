import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { RequestForm } from "@/components/projects/RequestForm";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.projects.newTitle, robots: { index: false } };
}

// Publier une demande de projet sur mesure (membres connectés)
export default async function NewProjectRequestPage() {
  await requireUser("/projects/new");
  const { t } = await getDictionary();
  return (
    <div className="container-q max-w-3xl pt-8">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> {t.projects.back}
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t.projects.newTitle}</h1>
      <p className="mt-2 text-[15px] text-muted">{t.projects.newIntro}</p>
      <RequestForm />
    </div>
  );
}
