import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import { Logo } from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Qubik — La marketplace Roblox", template: "%s · Qubik" },
  description: "Achète et vends des scripts, modèles et systèmes Roblox. Chaque ressource est scannée contre les backdoors.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="fr">
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
          <nav className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <Logo /> Qubik
            </Link>
            <Link href="/resources" className="text-sm text-muted hover:text-text">
              Catalogue
            </Link>
            <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
              {user ? (
                <>
                  {user.role === "ADMIN" && (
                    <Link href="/admin" className="text-muted hover:text-text">
                      Modération
                    </Link>
                  )}
                  <Link href="/dashboard" className="text-muted hover:text-text">
                    {user.username}
                  </Link>
                  <Link href="/sell" className="btn py-1.5">
                    Vendre
                  </Link>
                  <form action={logout}>
                    <button className="text-muted hover:text-text">Déconnexion</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-muted hover:text-text">
                    Connexion
                  </Link>
                  <Link href="/register" className="btn py-1.5">
                    Créer un compte
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted">
          © {new Date().getFullYear()} Qubik · Ressources Roblox scannées contre les backdoors · Qubik n&apos;est pas affilié à Roblox Corporation.
        </footer>
      </body>
    </html>
  );
}
