import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard/DashboardNav";

// Cadre commun aux onglets de « Mon espace » : menu à gauche, contenu à droite
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const [resources, purchases] = await Promise.all([
    db.resource.count({ where: { sellerId: user.id } }),
    db.purchase.count({ where: { userId: user.id, status: "PAID" } }),
  ]);

  return (
    <div className="full-bleed">
      <div className="container-q grid items-start gap-5 pt-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:pt-8">
        <DashboardNav username={user.username} avatarUrl={user.avatarUrl} isSeller={resources > 0} counts={{ resources, purchases }} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
