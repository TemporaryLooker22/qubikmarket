import { getDictionary } from "@/lib/i18n/server";

export async function StatusBadge({ status }: { status: string }) {
  const { t } = await getDictionary();
  const s = (status in t.status ? status : "PENDING") as keyof typeof t.status;
  return <span>[{t.status[s]}]</span>;
}
