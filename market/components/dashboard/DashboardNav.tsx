"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BadgeCheck, Briefcase, ChartLine, LayoutDashboard, Package, Receipt, Settings, ShoppingBag, type LucideIcon } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { useI18n } from "@/lib/i18n/client";
import { useActiveTabScroll } from "@/components/useActiveTabScroll";

type Props = { username: string; avatarUrl: string | null; isSeller: boolean; counts: { resources: number; purchases: number } };

// Menu de « Mon espace » : colonne à gauche sur ordinateur, rangée d'onglets qui défile sur téléphone
export function DashboardNav({ username, avatarUrl, isSeller, counts }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const navRef = useActiveTabScroll<HTMLElement>(pathname);

  const seller: { href: string; label: string; icon: LucideIcon; count?: number }[] = [
    { href: "/dashboard", label: t.dashboard.menu.overview, icon: LayoutDashboard },
    { href: "/dashboard/resources", label: t.dashboard.menu.resources, icon: Package, count: counts.resources },
    { href: "/dashboard/sales", label: t.dashboard.menu.sales, icon: Receipt },
    { href: "/dashboard/stats", label: t.dashboard.menu.stats, icon: ChartLine },
  ];
  const purchases = { href: "/dashboard/purchases", label: t.dashboard.menu.purchases, icon: ShoppingBag, count: counts.purchases };
  const projects = { href: "/dashboard/projects", label: t.dashboard.menu.projects, icon: Briefcase };
  const settings = { href: "/dashboard/settings", label: t.dashboard.menu.settings, icon: Settings };

  const item = ({ href, label, icon: Icon, count }: (typeof seller)[number]) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border px-2.5 py-2 text-sm font-semibold transition ${
          active ? "border-border bg-card text-text shadow-sm" : "border-transparent text-muted hover:bg-surface hover:text-text"
        }`}
      >
        {/* Trait jaune de l'onglet actif (ordinateur) */}
        {active && <span className="absolute -left-px bottom-2.5 top-2.5 hidden w-[3px] rounded-r bg-accent lg:block" aria-hidden="true" />}
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
        {count !== undefined && count > 0 && <span className="ml-auto rounded-full bg-surface px-1.5 text-[11px] font-semibold text-muted">{count}</span>}
      </Link>
    );
  };

  return (
    <aside className="min-w-0 lg:sticky lg:top-24">
      <div className="hidden items-center gap-2.5 px-1.5 pb-4 lg:flex">
        <UserAvatar name={username} src={avatarUrl} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{username}</p>
          {isSeller && (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-px text-[11px] font-bold text-ok">
              <BadgeCheck className="h-3 w-3" aria-hidden="true" />
              {t.dashboard.sellerBadge}
            </span>
          )}
        </div>
      </div>
      <nav ref={navRef} aria-label={t.dashboard.title} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {isSeller && seller.map(item)}
        {isSeller && <hr className="mx-2 my-2 hidden border-border lg:block" />}
        {item(purchases)}
        {item(projects)}
        {item(settings)}
      </nav>
    </aside>
  );
}
