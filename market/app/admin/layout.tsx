import { requireAdmin, siteOwnerId } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n/server";
import { moderationCounts } from "@/lib/moderation";
import { AdminNav } from "@/components/admin/AdminNav";

export async function generateMetadata() {
  const { t } = await getDictionary();
  return { title: t.admin.title };
}

// Cadre commun de la modération : menu à gauche (avec ce qui attend une décision), contenu à droite
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const [counts, ownerId] = await Promise.all([moderationCounts(), siteOwnerId()]);
  return (
    <div className="full-bleed">
      <div className="container-q grid grid-cols-[minmax(0,1fr)] items-start gap-5 pt-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:pt-8">
        <AdminNav username={user.username} owner={user.id === ownerId} counts={counts} />
        <div className="min-w-0 pb-16">{children}</div>
      </div>
    </div>
  );
}
