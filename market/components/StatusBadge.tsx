import { getDictionary } from "@/lib/i18n/server";

// Couleur de chaque statut : analyse en cours (jaune clair), en ligne (vert), en vérification (orange), refusée (rouge), retirée (gris)
const STYLES: Record<string, string> = {
  ANALYZING: "bg-accent-soft text-text",
  APPROVED: "bg-ok-bg text-ok",
  PENDING: "bg-warn-bg text-warn",
  REJECTED: "bg-bad-bg text-bad",
  UNLISTED: "bg-surface text-muted",
};

export async function StatusBadge({ status }: { status: string }) {
  const { t } = await getDictionary();
  const s = (status in t.status ? status : "PENDING") as keyof typeof t.status;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[s]}`}>{t.status[s]}</span>;
}
