import { getDictionary } from "@/lib/i18n/server";

export async function ScanBadge({ verdict }: { verdict: string }) {
  const { t } = await getDictionary();
  const v = (verdict in t.verdict ? verdict : "suspicious") as keyof typeof t.verdict;
  return <span>[{t.verdict[v]}]</span>;
}
