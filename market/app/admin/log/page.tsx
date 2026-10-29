import Link from "next/link";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { Badge, PageTitle } from "@/components/admin/AdminUi";

const TONES: Record<string, "ok" | "warn" | "bad" | "off"> = {
  APPROVE: "ok",
  KEEP: "ok",
  UNBAN: "ok",
  PUBLISH_PAUSE: "warn",
  PUBLISH_RESUME: "ok",
  PUBLISH_COOLDOWN: "off",
  REJECT: "bad",
  BAN: "bad",
  UNLIST: "warn",
  RELIST: "ok",
  EDIT: "off",
  REANALYZE: "off",
  DELETE: "bad",
  REVIEW_DELETE: "off",
  REPORTS_DISMISS: "off",
  CHAT_DISMISS: "off",
  CHAT_MESSAGE_DELETE: "warn",
  MEMBER_REVIEW_DELETE: "off",
  AVATAR_REMOVE: "warn",
  ROLE_GRANT: "warn",
  ROLE_REVOKE: "off",
  PROJECT_RELEASE: "ok",
  PROJECT_REFUND: "warn",
  EARNINGS_RELEASE: "ok",
};

// Modération → Journal : toutes les décisions, les plus récentes d'abord
export default async function AdminLogPage() {
  const { locale, t } = await getDictionary();
  const logs = await db.moderationLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { moderator: { select: { username: true } } } });
  const when = (d: Date) => d.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  // Lien vers ce qui est concerné (fiche du membre ; page de la ressource si elle existe encore)
  const slugs = new Map(
    (await db.resource.findMany({ where: { id: { in: logs.filter((l) => l.targetType === "resource").map((l) => l.targetId) } }, select: { id: true, slug: true } })).map((r) => [r.id, r.slug]),
  );
  const link = (l: (typeof logs)[number]) =>
    l.targetType === "user" ? `/admin/users?id=${l.targetId}` : l.targetType === "project" ? `/projects/work/${l.targetId}` : l.targetType === "conversation" ? `/admin/messages/${l.targetId}` : l.targetType === "resource" && slugs.has(l.targetId) ? `/resources/${slugs.get(l.targetId)}` : null;

  return (
    <>
      <PageTitle title={t.mod.menu.log} intro={t.mod.logIntro} />
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {logs.length === 0 ? (
          <p className="p-5 text-sm text-muted">{t.mod.logEmpty}</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted">
                <th className="px-4 py-3 font-bold">{t.mod.logCols.when}</th>
                <th className="px-4 py-3 font-bold">{t.mod.logCols.who}</th>
                <th className="px-4 py-3 font-bold">{t.mod.logCols.action}</th>
                <th className="px-4 py-3 font-bold">{t.mod.logCols.target}</th>
                <th className="px-4 py-3 font-bold">{t.mod.logCols.note}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((l) => {
                const href = link(l);
                return (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{when(l.createdAt)}</td>
                    <td className="px-4 py-3">{l.moderator.username}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TONES[l.action] ?? "off"}>{t.mod.logActions[l.action] ?? l.action}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {href ? (
                        <Link href={href} className="hover:underline">
                          {l.label}
                        </Link>
                      ) : (
                        l.label
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs text-muted">{l.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
