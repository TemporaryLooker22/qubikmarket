import { STATUS_LABELS } from "@/lib/catalog";

const STYLES = {
  APPROVED: "bg-ok-bg text-ok",
  PENDING: "bg-warn-bg text-warn",
  REJECTED: "bg-bad-bg text-bad",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const s = (status in STYLES ? status : "PENDING") as keyof typeof STYLES;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[s]}`}>{STATUS_LABELS[s]}</span>;
}
