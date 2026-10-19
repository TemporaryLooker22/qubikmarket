import { ArrowUpRight } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";

export const PARTNER_URL = "https://boros.be";

// Fine bande tout en haut du site : partenariat avec Boros (achat et vente de jeux Roblox qui ont déjà des joueurs).
// Lien marqué « sponsored » pour les moteurs de recherche.
export async function PartnerBanner() {
  const { t } = await getDictionary();
  return (
    <div className="border-b border-border bg-surface/60">
      <p className="container-q flex min-h-7 items-center justify-center gap-x-1.5 py-1 text-center text-[11px] leading-tight text-muted">
        <span className="truncate">{t.partner.text}</span>
        <a href={PARTNER_URL} target="_blank" rel="sponsored noopener noreferrer" className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-text hover:underline">
          {t.partner.cta}
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}
