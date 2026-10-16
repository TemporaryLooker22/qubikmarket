import { VERDICT_LABELS } from "@/lib/catalog";

const STYLES = {
  clean: "bg-ok-bg text-ok",
  suspicious: "bg-warn-bg text-warn",
  dangerous: "bg-bad-bg text-bad",
} as const;

const ICONS = { clean: "✓", suspicious: "⚠", dangerous: "✕" } as const;

export function ScanBadge({ verdict }: { verdict: string }) {
  const v = (verdict in STYLES ? verdict : "suspicious") as keyof typeof STYLES;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[v]}`}>
      {ICONS[v]} {VERDICT_LABELS[v]}
    </span>
  );
}
