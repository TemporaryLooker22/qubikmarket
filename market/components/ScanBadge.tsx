import { VERDICT_LABELS } from "@/lib/catalog";

export function ScanBadge({ verdict }: { verdict: string }) {
  const v = (verdict in VERDICT_LABELS ? verdict : "suspicious") as keyof typeof VERDICT_LABELS;
  return <span>[{VERDICT_LABELS[v]}]</span>;
}
