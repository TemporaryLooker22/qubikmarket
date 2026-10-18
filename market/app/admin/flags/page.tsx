import Link from "next/link";
import { Flag } from "lucide-react";
import { db } from "@/lib/db";
import { categoryLabel } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n/server";
import { formatPrice } from "@/lib/i18n/format";
import { AI_FLAGS } from "@/lib/moderation";
import { reviewAiFlag } from "@/app/resource-actions";
import { AiReportView } from "@/components/AiReportView";
import { Thumb } from "@/components/dashboard/Thumb";
import { Badge, PageTitle } from "@/components/admin/AdminUi";
import { DecisionForm } from "@/components/admin/DecisionForm";

// Modération → Signalements IA : ressources en ligne que l'IA a signalées.
// « C'est bon » garde la ressource ; « Retirer de la vente » la sort du catalogue (les acheteurs gardent leur téléchargement).
export default async function AdminFlagsPage() {
  const { locale, t } = await getDictionary();
  const flagged = await db.resourceVersion.findMany({
    where: AI_FLAGS,
    orderBy: { aiAt: "asc" },
    include: {
      resource: {
        select: { id: true, slug: true, title: true, category: true, priceCents: true, images: true, sellerId: true, seller: { select: { username: true } }, _count: { select: { purchases: { where: { status: "PAID" } } } } },
      },
    },
  });

  return (
    <>
      <PageTitle title={t.mod.menu.flags} intro={t.mod.flagsIntro} />
      {flagged.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-card px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-bg text-ok">
            <Flag className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-3 font-semibold">{t.mod.flagsEmpty}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {flagged.map((v) => (
            <li key={v.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-3">
                <Thumb image={v.resource.images[0]} category={v.resource.category} className="w-[84px]" />
                <div className="min-w-0">
                  <Link href={`/resources/${v.resource.slug}`} className="block truncate font-semibold hover:underline">
                    {v.resource.title}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    <Link href={`/admin/users?id=${v.resource.sellerId}`} className="hover:underline">
                      {v.resource.seller.username}
                    </Link>{" "}
                    · {categoryLabel(v.resource.category)} · {formatPrice(v.resource.priceCents, locale)} · {t.card.sales(v.resource._count.purchases)} · v{v.version}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={(v.aiMatch ?? 0) < 50 ? "warn" : "ok"}>{`${t.ai.match} ${v.aiMatch}`}</Badge>
                    <Badge tone={(v.aiQuality ?? 0) < 50 ? "warn" : "ok"}>{`${t.ai.quality} ${v.aiQuality}`}</Badge>
                  </div>
                </div>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-text">{t.mod.seeReport}</summary>
                <div className="mt-2">
                  <AiReportView analysis={v} showTips={false} />
                </div>
              </details>
              <div className="mt-3">
                <DecisionForm
                  action={reviewAiFlag}
                  hidden={{ versionId: v.id }}
                  choices={[
                    { value: "keep", label: t.admin.keep, tone: "approve" },
                    { value: "unlist", label: t.admin.unlist, tone: "reject" },
                  ]}
                />
                <p className="mt-1.5 text-xs text-muted">{t.mod.unlistNote}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
