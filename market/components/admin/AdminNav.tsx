"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, LayoutDashboard, Package, ScrollText, ShieldCheck, Star, Users, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

type Props = { username: string; counts: { queue: number; flags: number; reports: number } };

// Menu de la modération : colonne à gauche sur ordinateur, rangée d'onglets qui défile sur téléphone
export function AdminNav({ username, counts }: Props) {
  const { t } = useI18n();
  const pathname = usePathname();
  const items: { href: string; label: string; icon: LucideIcon; count?: number }[] = [
    { href: "/admin", label: t.mod.menu.overview, icon: LayoutDashboard },
    { href: "/admin/queue", label: t.mod.menu.queue, icon: ShieldCheck, count: counts.queue },
    { href: "/admin/flags", label: t.mod.menu.flags, icon: Flag, count: counts.flags },
    { href: "/admin/reviews", label: t.mod.menu.reviews, icon: Star, count: counts.reports },
    { href: "/admin/resources", label: t.mod.menu.resources, icon: Package },
    { href: "/admin/users", label: t.mod.menu.users, icon: Users },
    { href: "/admin/log", label: t.mod.menu.log, icon: ScrollText },
  ];

  return (
    <aside className="min-w-0 lg:sticky lg:top-24">
      <div className="hidden items-center gap-2.5 px-1.5 pb-4 lg:flex">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-text font-semibold uppercase text-bg">{username.slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{username}</p>
          <p className="text-xs text-muted">{t.mod.role}</p>
        </div>
      </div>
      <nav aria-label={t.admin.title} className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {items.map(({ href, label, icon: Icon, count }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl border px-2.5 py-2 text-sm font-semibold transition ${
                active ? "border-border bg-card text-text shadow-sm" : "border-transparent text-muted hover:bg-surface hover:text-text"
              }`}
            >
              {active && <span className="absolute -left-px bottom-2.5 top-2.5 hidden w-[3px] rounded-r bg-accent lg:block" aria-hidden="true" />}
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
              {/* Compteur jaune : quelque chose attend une décision */}
              {count !== undefined && count > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-bold text-text">{count}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
