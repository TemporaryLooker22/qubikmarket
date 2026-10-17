import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/db";
import { feePercentFor } from "@/lib/earnings";
import { SellForm } from "@/components/SellForm";


// L'analyse IA tourne en arrière-plan après la réponse : on laisse le temps aux nouveaux essais (OVH)
export const maxDuration = 120;
export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.sell.title };
}

// Page « Vendre une ressource » (réservée aux membres connectés)
export default async function SellPage() {
  const user = await requireUser("/sell");
  const [{ t }, seller] = await Promise.all([getDictionary(), db.user.findUnique({ where: { id: user.id }, select: { founderUntil: true } })]);
  // Commission du vendeur aujourd'hui (taux réduit s'il est fondateur)
  const feePercent = feePercentFor({ founderUntil: seller?.founderUntil ?? null }, new Date());
  return (
    <div className="full-bleed">
      <div className="container-q pt-8">
        <nav aria-label="Breadcrumb" className="animate-fade-up flex items-center gap-1.5 text-sm text-muted">
          <Link href="/dashboard" className="hover:text-text">
            {t.sell.breadcrumb}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-current="page">{t.sell.title}</span>
        </nav>
        <h1 className="animate-fade-up mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t.sell.title}</h1>
        <p className="animate-fade-up mt-2 flex items-center gap-2 text-[15px] text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
          {t.sell.intro}
        </p>
        <SellForm feePercent={feePercent} username={user.username} />
      </div>
    </div>
  );
}
