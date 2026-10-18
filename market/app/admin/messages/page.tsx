import Link from "next/link";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { Badge, PageTitle, Panel } from "@/components/admin/AdminUi";

const include = {
  userA: { select: { username: true } },
  userB: { select: { username: true } },
  reports: { orderBy: { createdAt: "desc" }, include: { user: { select: { username: true } } } },
} as const;

// Modération → Messages signalés : seules les conversations signalées par un membre sont listées (et lisibles)
export default async function AdminChatsPage() {
  const { locale, t } = await getDictionary();
  const [open, closed] = await Promise.all([
    db.conversation.findMany({ where: { reports: { some: { dismissedAt: null } } }, orderBy: { lastMessageAt: "desc" }, include }),
    db.conversation.findMany({ where: { reports: { some: {}, every: { dismissedAt: { not: null } } } }, orderBy: { lastMessageAt: "desc" }, take: 20, include }),
  ]);

  return (
    <>
      <PageTitle title={t.mod.menu.chats} intro={t.mod.chatsIntro} />
      <Panel title={t.mod.chatReports} aside={open.length > 0 ? <Badge tone="bad">{open.length}</Badge> : undefined} className="mb-4">
        {open.length === 0 ? <p className="text-sm text-muted">{t.mod.chatsEmpty}</p> : <ChatTable list={open} openOnly locale={locale} t={t} />}
      </Panel>
      {closed.length > 0 && (
        <Panel title={t.mod.chatsClosed}>
          <ChatTable list={closed} locale={locale} t={t} />
        </Panel>
      )}
    </>
  );
}

type Row = {
  id: string;
  userA: { username: string };
  userB: { username: string };
  reports: { id: string; reason: string; createdAt: Date; dismissedAt: Date | null; user: { username: string } }[];
};

function ChatTable({ list, openOnly = false, locale, t }: { list: Row[]; openOnly?: boolean; locale: Locale; t: Dictionary }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="pb-2 font-bold">{t.mod.chatsCols.conversation}</th>
            <th className="pb-2 font-bold">{t.mod.chatsCols.by}</th>
            <th className="pb-2 font-bold">{t.mod.chatsCols.reason}</th>
            <th className="pb-2 font-bold">{t.mod.chatsCols.when}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((c) => {
            const reports = openOnly ? c.reports.filter((r) => !r.dismissedAt) : c.reports;
            const first = reports[0];
            return (
              <tr key={c.id} className="border-t border-border">
                <td className="py-2.5 pr-3">
                  <b>{c.userA.username}</b> ↔ <b>{c.userB.username}</b>
                </td>
                <td className="py-2.5 pr-3">{reports.map((r) => r.user.username).join(", ")}</td>
                <td className="py-2.5 pr-3">
                  <span className="flex flex-wrap gap-1">
                    {[...new Set(reports.map((r) => r.reason))].map((reason) => (
                      <Badge key={reason} tone={reason === "OFF_PLATFORM" ? "warn" : "bad"}>
                        {t.chat.report.reasons[reason] ?? reason}
                      </Badge>
                    ))}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-muted">{first && formatDate(first.createdAt, locale)}</td>
                <td className="py-2.5 text-right">
                  <Link href={`/admin/messages/${c.id}`} className="font-semibold hover:underline">
                    {t.mod.chatsOpen}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
