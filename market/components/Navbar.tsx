"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Search, UserPlus, X, Zap } from "lucide-react";
import { logout, setLocale } from "@/app/actions";
import { CATEGORIES } from "@/lib/catalog";
import { LOCALES } from "@/lib/i18n/dictionaries";
import { useI18n } from "@/lib/i18n/client";
import { CategoryIcon } from "./CategoryIcon";
import { Logo } from "./Logo";

type Props = {
  user: { username: string; role: string } | null;
  pendingCount: number; // ressources en attente de modération (affiché aux admins)
};

// Barre de navigation flottante, en haut de toutes les pages
export function Navbar({ user, pendingCount }: Props) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ferme le menu mobile quand on change de page
  useEffect(() => setMobileOpen(false), [pathname]);

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/resources", label: t.nav.catalog },
    ...(user ? [{ href: "/dashboard", label: t.nav.dashboard }] : [{ href: "/sell", label: t.nav.sell }]),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: t.nav.moderation, badge: pendingCount }] : []),
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
            <NavLink key={l.href} {...l} active={isActive(l.href)} />
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
              <AccountMenu username={user.username} />
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
        <div className="animate-pop mx-auto mt-2 max-w-6xl origin-top rounded-2xl border border-border bg-card p-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] md:hidden">
          {[...links, ...(user ? [{ href: "/sell", label: t.nav.sell }] : [{ href: "/login", label: t.nav.login }])].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-bg ${isActive(l.href) ? "text-text" : "text-muted"}`}
            >
              {l.label}
              {"badge" in l && l.badge ? <Badge count={l.badge} /> : null}
            </Link>
          ))}
          <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted">{t.nav.categories}</p>
          <div className="grid grid-cols-2">
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={`/resources?category=${c.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-bg">
                <CategoryIcon category={c.id} className="h-4 w-4 text-muted" /> {c.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 pb-1 pt-3">
            <span className="text-xs font-medium text-muted">{t.nav.language}</span>
            <LanguageSwitch />
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

function AccountMenu({ username }: { username: string }) {
  const { t } = useI18n();
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t.nav.account}
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-text text-sm font-semibold uppercase text-bg ring-offset-2 transition hover:ring-2 hover:ring-border-strong ${open ? "ring-2 ring-border-strong" : ""}`}
      >
        {username.slice(0, 1)}
      </button>
      {open && (
        <div className="animate-pop absolute right-0 top-full mt-2 w-52 origin-top-right rounded-xl border border-border bg-card p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <p className="truncate px-3 py-2 text-xs text-muted">{t.nav.signedInAs(username)}</p>
          <Link href="/dashboard" className="block rounded-lg px-3 py-2 text-[15px] transition hover:bg-bg">
            {t.nav.dashboard}
          </Link>
          <Link href="/sell" className="block rounded-lg px-3 py-2 text-[15px] transition hover:bg-bg">
            {t.nav.sellResource}
          </Link>
          <form action={logout}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-[15px] transition hover:bg-bg">{t.nav.logout}</button>
          </form>
        </div>
      )}
    </div>
  );
}
