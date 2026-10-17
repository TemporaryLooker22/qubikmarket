import { STATUS_LABELS } from "@/lib/catalog";

export function StatusBadge({ status }: { status: string }) {
  const s = (status in STATUS_LABELS ? status : "PENDING") as keyof typeof STATUS_LABELS;
  return <span>[{STATUS_LABELS[s]}]</span>;
}
