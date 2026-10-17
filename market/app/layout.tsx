import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "./actions";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Qubik — La marketplace Roblox", template: "%s · Qubik" },
  description: "Achète et vends des scripts, modèles et systèmes Roblox. Chaque ressource est scannée contre les backdoors.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="fr">
      <body>
        <header>
          <nav>
            <Link href="/">Qubik</Link> · <Link href="/resources">Catalogue</Link> ·{" "}
            {user ? (
              <>
                {user.role === "ADMIN" && <><Link href="/admin">Modération</Link> · </>}
                <Link href="/dashboard">{user.username}</Link> · <Link href="/sell">Vendre</Link>
                <form action={logout}>
                  <button>Déconnexion</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Connexion</Link> · <Link href="/register">Créer un compte</Link>
              </>
            )}
          </nav>
        </header>

        <main>{children}</main>

        <footer>
          © {new Date().getFullYear()} Qubik · Qubik n&apos;est pas affilié à Roblox Corporation.
        </footer>
      </body>
    </html>
  );
}
