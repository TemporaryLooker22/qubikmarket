"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Home, LayoutDashboard, LayoutGrid, LogIn, LogOut, Menu, Search, ShieldCheck, ShoppingBag, Store, Upload, UserPlus, X, Zap, type LucideIcon } from "lucide-react";
import { logout, setLocale } from "@/app/actions";
import { CATEGORIES } from "@/lib/catalog";
import { LOCALES } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/client";
import { CategoryIcon } from "./CategoryIcon";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { MessagesIcon } from "./chat/MessagesIcon";

type Props = {
  user: { username: string; email: string; role: string; isSeller: boolean } | null;
  pendingCount: number; // ressources en attente de modération (affiché aux admins)
  unreadCount: number; // notifications non lues (cloche)
  chatUnread: number; // conversations non lues (icône Messages)
};

// Barre de navigation flottante, en haut de toutes les pages
export function Navbar({ user, pendingCount, unreadCount, chatUnread }: Props) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ferme le menu mobile quand on change de page
  useEffect(() => setMobileOpen(false), [pathname]);

  const links: { href: string; label: string; icon: LucideIcon; badge?: number }[] = [
    { href: "/", label: t.nav.home, icon: Home },
    { href: "/resources", label: t.nav.catalog, icon: LayoutGrid },
    ...(user ? [{ href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard }] : [{ href: "/sell", label: t.nav.sell, icon: Upload }]),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: t.nav.moderation, icon: ShieldCheck, badge: pendingCount }] : []),
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  // Après la connexion ou l'inscription, on revient sur la page actuelle
  const next = pathname === "/" || /^\/(login|register)/.test(pathname) ? "" : `?next=${encodeURIComponent(pathname)}`;

  return (
    <header className="sticky top-0 z-20 px-3 pt-3">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-2 rounded-2xl border border-border bg-card/95 px-3 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur sm:px-4">
        <Link href="/" className="mr-2 flex items-center gap-2 rounded-lg p-1 font-bold sm:mr-4" aria-label={t.nav.homeAria}>
          <Logo className="h-7 w-7 transition-transform duration-300 hover:-rotate-6 hover:scale-110" />
          <span className="hidden text-base sm:inline">Qubik</span>
        </Link>

        {/* Liens (ordinateur) */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.href} href={l.href} label={l.label} badge={l.badge} active={isActive(l.href)} />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitch className="hidden sm:flex" />
          <Link
            href="/resources"
            aria-label={t.nav.search}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text transition hover:bg-bg"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2} />
          </Link>

          {user ? (
            <>
              <MessagesIcon initialUnread={chatUnread} />
              <NotificationBell initialUnread={unreadCount} />
              <AccountMenu user={user} pendingCount={pendingCount} />
              <Link href="/sell" className="hidden h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-text transition hover:-translate-y-px hover:bg-accent-hover sm:inline-flex">
                <Zap className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> {t.nav.sell}
              </Link>
            </>
          ) : (
            <>
              <Link href={`/login${next}`} className="hidden h-10 items-center rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-bg hover:text-text sm:flex">
                {t.nav.login}
              </Link>
              <Link href={`/register${next}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-text transition hover:-translate-y-px hover:bg-accent-hover sm:px-4">
                <UserPlus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span className="hidden sm:inline">{t.nav.signup}</span>
                <span className="sm:hidden">{t.nav.signupShort}</span>
              </Link>
            </>
          )}

          {/* Bouton du menu mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-bg md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="animate-pop mx-auto mt-2 max-w-6xl origin-top overflow-hidden rounded-2xl border border-border bg-card shadow-[0_16px_40px_-12px_rgba(0,0,0,0.2)] md:hidden">
          {user && <AccountHeader user={user} />}
          <div className="p-2">
            {[
              ...links,
              ...(user ? [{ href: "/sell", label: t.nav.sellResource, icon: Upload }] : [{ href: `/login${next}`, label: t.nav.login, icon: LogIn }]),
              ...(!user?.isSeller ? [{ href: "/become-seller", label: t.nav.becomeSeller, icon: Store }] : []),
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition hover:bg-bg ${isActive(l.href) ? "bg-bg text-text" : "text-muted"}`}
              >
                <l.icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                <span className="flex-1">{l.label}</span>
                {"badge" in l && l.badge ? <Badge count={l.badge} /> : null}
              </Link>
            ))}
          </div>
          <div className="border-t border-border p-2">
            <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{t.nav.categories}</p>
            <div className="grid grid-cols-2">
              {CATEGORIES.map((c) => (
                <Link key={c.id} href={`/resources?category=${c.id}`} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition hover:bg-bg">
                  <CategoryIcon category={c.id} className="h-4 w-4 text-muted" /> {c.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border bg-bg/60 px-4 py-3">
            <LanguageSwitch />
            {user && (
              <form action={logout}>
                <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-bad-bg hover:text-bad">
                  <LogOut className="h-4 w-4" aria-hidden="true" /> {t.nav.logout}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

// Sélecteur de langue EN / FR : enregistre le choix dans un cookie (action setLocale)
function LanguageSwitch({ className = "" }: { className?: string }) {
  const { locale, t } = useI18n();
  return (
    <form action={setLocale} className={`items-center rounded-lg bg-bg p-0.5 ${className || "flex"}`} aria-label={t.nav.language}>
      {LOCALES.map((l) => (
        <button
          key={l}
          name="locale"
          value={l}
          aria-pressed={l === locale}
          className={`h-8 rounded-md px-2.5 text-xs font-bold uppercase transition ${
            l === locale ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"
          }`}
        >
          {l}
        </button>
      ))}
    </form>
  );
}

function NavLink({ href, label, active, badge }: { href: string; label: string; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-10 items-center gap-2 rounded-lg px-3 text-[15px] font-medium transition hover:bg-bg ${active ? "text-text" : "text-muted hover:text-text"}`}
    >
      {label}
      {badge ? <Badge count={badge} /> : null}
      {/* Petit trait jaune sous la page active */}
      {active && <span className="animate-grow-x absolute inset-x-3 -bottom-0.5 h-[3px] rounded-full bg-accent" aria-hidden="true" />}
    </Link>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-text">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Gère l'ouverture d'un menu déroulant : clic à l'extérieur ou touche Échap pour fermer
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

// En-tête du menu du compte : avatar, pseudo, email et badge admin
function AccountHeader({ user }: { user: NonNullable<Props["user"]> }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 border-b border-border bg-bg/60 px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-text text-sm font-semibold uppercase text-bg">
        {user.username.slice(0, 1)}
      </span>
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-semibold">
          {user.username}
          {user.role === "ADMIN" && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{t.nav.adminBadge}</span>
          )}
        </p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>
    </div>
  );
}

// Menu du compte (ordinateur) : clic sur l'avatar, navigation au clavier avec les flèches
function AccountMenu({ user, pendingCount }: { user: NonNullable<Props["user"]>; pendingCount: number }) {
  const { t } = useI18n();
  const { open, setOpen, ref } = useDropdown();
  const menuRef = useRef<HTMLDivElement>(null);

  // À l'ouverture, on place le focus sur la première entrée (pratique au clavier)
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex = (index + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  const items: { href: string; label: string; icon: LucideIcon; badge?: number }[] = [
    { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
    { href: "/sell", label: t.nav.sellResource, icon: Upload },
    { href: "/dashboard/purchases", label: t.nav.myPurchases, icon: ShoppingBag },
    ...(!user.isSeller ? [{ href: "/become-seller", label: t.nav.becomeSeller, icon: Store }] : []),
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: t.nav.moderation, icon: ShieldCheck, badge: pendingCount }] : []),
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.nav.account}
        className={`flex h-10 items-center gap-1 rounded-full p-0.5 pr-1.5 transition hover:bg-bg ${open ? "bg-bg" : ""}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-text text-sm font-semibold uppercase text-bg">
          {user.username.slice(0, 1)}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onKeyDown}
          className="animate-pop absolute right-0 top-full mt-2 w-72 origin-top-right overflow-hidden rounded-2xl border border-border bg-card shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)]"
        >
          <AccountHeader user={user} />
          <div className="p-1.5">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text/80 outline-none transition hover:bg-bg hover:text-text focus-visible:bg-bg focus-visible:text-text"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg text-muted transition group-hover:bg-accent group-hover:text-text group-focus-visible:bg-accent group-focus-visible:text-text">
                  <item.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge ? <Badge count={item.badge} /> : null}
              </Link>
            ))}
          </div>
          <form action={logout} className="border-t border-border p-1.5">
            <button
              role="menuitem"
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-text/80 outline-none transition hover:bg-bad-bg hover:text-bad focus-visible:bg-bad-bg focus-visible:text-bad"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg text-muted transition group-hover:bg-card group-hover:text-bad">
                <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </span>
              {t.nav.logout}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
