import { getDictionary } from "@/lib/i18n/server";

const STYLES = { clean: "bg-ok-bg text-ok", suspicious: "bg-warn-bg text-warn", dangerous: "bg-bad-bg text-bad" };

export async function ScanBadge({ verdict }: { verdict: string }) {
  const { t } = await getDictionary();
  const v = (verdict in t.verdict ? verdict : "suspicious") as keyof typeof t.verdict;
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[v]}`}>{t.verdict[v]}</span>;
}
