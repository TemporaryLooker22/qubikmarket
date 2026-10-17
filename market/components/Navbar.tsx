"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Search, UserPlus, X, Zap } from "lucide-react";
import { logout } from "@/app/actions";
import { CATEGORIES } from "@/lib/catalog";
import { CategoryIcon } from "./CategoryIcon";
import { Logo } from "./Logo";

type Props = {
  user: { username: string; role: string } | null;
  pendingCount: number; // ressources en attente de modération (affiché aux admins)
};

// Barre de navigation flottante, en haut de toutes les pages
export function Navbar({ user, pendingCount }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ferme le menu mobile quand on change de page
  useEffect(() => setMobileOpen(false), [pathname]);

  const links = [
    { href: "/", label: "Accueil" },
    { href: "/resources", label: "Catalogue" },
    ...(user ? [{ href: "/dashboard", label: "Mon espace" }] : [{ href: "/sell", label: "Vendre" }]),
    ...(user?.role === "ADMIN" ? [{ href: "/admin", label: "Modération", badge: pendingCount }] : []),
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-20 px-3 pt-3">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-2 rounded-2xl border border-border bg-bg/95 px-3 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] backdrop-blur sm:px-4">
        <Link href="/" className="mr-2 flex items-center gap-2 rounded-lg p-1 font-bold sm:mr-4" aria-label="Qubik, accueil">
          <Logo className="h-7 w-7" />
          <span className="hidden text-base sm:inline">Qubik</span>
        </Link>

        {/* Liens (ordinateur) */}
        <div className="hidden items-center gap-1 md:flex">
          {links.slice(0, 2).map((l) => (
            <NavLink key={l.href} {...l} active={isActive(l.href)} />
          ))}
          <CategoriesMenu />
          {links.slice(2).map((l) => (
            <NavLink key={l.href} {...l} active={isActive(l.href)} />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/resources"
            aria-label="Rechercher"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text transition hover:bg-surface"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2} />
          </Link>

          {user ? (
            <>
              <AccountMenu username={user.username} />
              <Link href="/sell" className="hidden h-10 items-center gap-2 rounded-lg bg-text px-4 text-sm font-semibold text-bg transition hover:bg-text/85 sm:inline-flex">
                <Zap className="h-4 w-4" strokeWidth={2} aria-hidden="true" /> Vendre
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden h-10 items-center rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-surface hover:text-text sm:flex">
                Connexion
              </Link>
              <Link href="/register" className="inline-flex h-10 items-center gap-2 rounded-lg bg-text px-3 text-sm font-semibold text-bg transition hover:bg-text/85 sm:px-4">
                <UserPlus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                <span className="hidden sm:inline">Créer un compte</span>
                <span className="sm:hidden">Inscription</span>
              </Link>
            </>
          )}

          {/* Bouton du menu mobile */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileOpen}
            className="flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-surface md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Menu mobile */}
      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-6xl rounded-2xl border border-border bg-bg p-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] md:hidden">
          {[...links, ...(user ? [{ href: "/sell", label: "Vendre" }] : [{ href: "/login", label: "Connexion" }])].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface ${isActive(l.href) ? "text-text" : "text-muted"}`}
            >
              {l.label}
              {"badge" in l && l.badge ? <Badge count={l.badge} /> : null}
            </Link>
          ))}
          <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted">Catégories</p>
          <div className="grid grid-cols-2">
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={`/resources?category=${c.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface">
                <CategoryIcon category={c.id} className="h-4 w-4 text-muted" /> {c.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, active, badge }: { href: string; label: string; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex h-10 items-center gap-2 rounded-lg px-3 text-[15px] font-medium transition hover:bg-surface ${active ? "text-text" : "text-muted hover:text-text"}`}
    >
      {label}
      {badge ? <Badge count={badge} /> : null}
    </Link>
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-text px-1.5 text-[11px] font-semibold text-bg">
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

function CategoriesMenu() {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-10 items-center gap-1.5 rounded-lg px-3 text-[15px] font-medium transition hover:bg-surface hover:text-text ${open ? "bg-surface text-text" : "text-muted"}`}
      >
        Catégories <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-border bg-bg p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/resources?category=${c.id}`}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] transition hover:bg-surface"
            >
              <CategoryIcon category={c.id} className="h-4 w-4 text-muted" /> {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountMenu({ username }: { username: string }) {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Mon compte"
        className={`flex h-10 w-10 items-center justify-center rounded-full bg-text text-sm font-semibold uppercase text-bg ring-offset-2 transition hover:ring-2 hover:ring-border-strong ${open ? "ring-2 ring-border-strong" : ""}`}
      >
        {username.slice(0, 1)}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-bg p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <p className="truncate px-3 py-2 text-xs text-muted">Connecté en tant que {username}</p>
          <Link href="/dashboard" className="block rounded-lg px-3 py-2 text-[15px] transition hover:bg-surface">
            Mon espace
          </Link>
          <Link href="/sell" className="block rounded-lg px-3 py-2 text-[15px] transition hover:bg-surface">
            Vendre une ressource
          </Link>
          <form action={logout}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-[15px] transition hover:bg-surface">Déconnexion</button>
          </form>
        </div>
      )}
    </div>
  );
}
