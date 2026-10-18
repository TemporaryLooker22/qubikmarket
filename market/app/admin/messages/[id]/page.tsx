import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, ShieldAlert, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/i18n/format";
import { banMember } from "@/app/moderation-actions";
import { deleteChatMessage, dismissChatReports } from "@/app/chat-actions";
import { Badge, PageTitle, Panel } from "@/components/admin/AdminUi";

const member = { select: { id: true, username: true, role: true, bannedAt: true } } as const;

// Modération → Messages signalés → une conversation. Lisible seulement si un membre l'a signalée.
export default async function AdminChatPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { locale, t }] = await Promise.all([params, getDictionary()]);
  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      userA: member,
      userB: member,
      reports: { orderBy: { createdAt: "asc" }, include: { user: { select: { username: true } } } },
    },
  });
  if (!conversation) notFound();
  if (conversation.reports.length === 0) {
    return (
      <>
        <PageTitle title={t.mod.menu.chats} />
        <Panel>
          <p className="text-sm text-muted">{t.mod.chatPrivate}</p>
        </Panel>
      </>
    );
  }

  const messages = await db.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" }, take: 500 });
  const resources = new Map(
    (await db.resource.findMany({ where: { id: { in: messages.flatMap((m) => (m.resourceId ? [m.resourceId] : [])) } }, select: { id: true, slug: true, title: true } })).map((r) => [r.id, r]),
  );
  const names = new Map([conversation.userA, conversation.userB].map((u) => [u.id, u.username]));
  const open = conversation.reports.filter((r) => !r.dismissedAt);
  const when = (d: Date) => d.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <>
      <Link href="/admin/messages" className="mb-3 inline-block text-sm font-semibold text-muted hover:text-text">
        {t.mod.chatBack}
      </Link>
      <PageTitle title={`${conversation.userA.username} ↔ ${conversation.userB.username}`} />

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title={t.mod.chatReports}>
          <ul className="space-y-2">
            {conversation.reports.map((r) => (
              <li key={r.id} className={`rounded-lg px-3 py-2 text-sm ${r.dismissedAt ? "bg-surface text-muted" : "bg-warn-bg text-warn"}`}>
                <b>{r.user.username}</b> · {t.chat.report.reasons[r.reason] ?? r.reason} · {formatDate(r.createdAt, locale)}
                {r.note && <p className="mt-1">« {r.note} »</p>}
              </li>
            ))}
          </ul>
          {open.length > 0 ? (
            <form action={dismissChatReports.bind(null, id)} className="mt-3">
              <button className="btn-ghost px-3 py-1.5 text-sm">{t.mod.chatDismiss}</button>
            </form>
          ) : (
            <p className="mt-3 text-xs text-muted">{t.mod.chatDismissed}</p>
          )}
        </Panel>

        <Panel title={t.mod.menu.users}>
          <div className="space-y-3">
            {[conversation.userA, conversation.userB].map((u) => (
              <div key={u.id} className="rounded-xl border border-border p-3">
                <p className="flex items-center gap-2 text-sm">
                  <Link href={`/admin/users?id=${u.id}`} className="font-semibold hover:underline">
                    {u.username}
                  </Link>
                  {u.bannedAt && <Badge tone="bad">{t.mod.chatBanned(u.username)}</Badge>}
                </p>
                {!u.bannedAt && u.role !== "ADMIN" && (
                  <form action={banMember} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <input name="reason" maxLength={500} placeholder={t.mod.chatBanReason} className="min-w-0 flex-1 rounded-lg border border-border px-3 py-1.5 text-sm" />
                    <button className="inline-flex items-center gap-1.5 rounded-lg bg-bad px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90">
                      <Ban className="h-3.5 w-3.5" aria-hidden="true" /> {t.mod.chatBan(u.username)}
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title={t.chat.title}>
        <ul className="space-y-3">
          {messages.map((m) => {
            const about = m.resourceId ? resources.get(m.resourceId) : undefined;
            return (
              <li key={m.id} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-text text-xs font-bold uppercase text-bg">{(names.get(m.senderId) ?? "?").slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    <b className="text-text">{names.get(m.senderId)}</b> · {when(m.createdAt)}
                    {m.offPlatform && (
                      <span className="ml-2 inline-flex">
                        <Badge tone="warn">
                          <ShieldAlert className="h-3 w-3" aria-hidden="true" /> {t.mod.chatOffPlatform}
                        </Badge>
                      </span>
                    )}
                  </p>
                  {m.kind === "ABOUT" ? (
                    <p className="mt-0.5 text-sm text-muted">
                      {t.chat.about} :{" "}
                      {about ? (
                        <Link href={`/resources/${about.slug}`} className="font-semibold text-text hover:underline">
                          {about.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </p>
                  ) : (
                    <div className={m.deletedAt ? "opacity-50" : ""}>
                      {m.body && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{m.body}</p>}
                      {m.images.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {m.images.map((src) => (
                            <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={src} alt="" className="h-20 w-28 rounded-lg border border-border object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                      {m.deletedAt && <p className="mt-0.5 text-xs italic text-muted">{t.chat.deleted}</p>}
                    </div>
                  )}
                </div>
                {m.kind === "TEXT" && !m.deletedAt && (
                  <form action={deleteChatMessage.bind(null, m.id)} className="shrink-0">
                    <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-bad transition hover:bg-bad-bg">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> {t.mod.chatDelete}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
