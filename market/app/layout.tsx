import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import { Logo } from "@/components/Logo";
import "./globals.css";

// Police du site (moderne et sobre), chargée et hébergée par Next.js
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: { default: "Qubik — La marketplace Roblox", template: "%s · Qubik" },
  description: "Achète et vends des scripts, modèles et systèmes Roblox. Chaque ressource est scannée contre les backdoors.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="fr" className={geist.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
          <nav className="container-q flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 py-2 text-sm sm:gap-x-6">
            <Link href="/" className="flex items-center gap-2 text-base font-semibold">
              <Logo /> Qubik
            </Link>
            <Link href="/resources" className="text-muted hover:text-text">
              Catalogue
            </Link>
            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5">
              {user ? (
                <>
                  {user.role === "ADMIN" && (
                    <Link href="/admin" className="text-muted hover:text-text">
                      Modération
                    </Link>
                  )}
                  <Link href="/sell" className="text-muted hover:text-text">
                    Vendre
                  </Link>
                  <Link href="/dashboard" className="text-muted hover:text-text">
                    {user.username}
                  </Link>
                  <form action={logout}>
                    <button className="text-muted hover:text-text">Déconnexion</button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/sell" className="text-muted hover:text-text">
                    Vendre
                  </Link>
                  <Link href="/login" className="btn py-1.5">
                    Connexion
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>

        <main className="flex-1 pb-16">{children}</main>

        <footer className="border-t border-border">
          <div className="container-q flex flex-wrap justify-between gap-3 py-6 text-xs text-muted">
            <span>© {new Date().getFullYear()} Qubik · Qubik n&apos;est pas affilié à Roblox Corporation.</span>
            <span>Chaque ressource est scannée contre les backdoors.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
