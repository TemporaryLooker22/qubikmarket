import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Navbar } from "@/components/Navbar";
import "./globals.css";

// Police du site : Plus Jakarta Sans, chargée et hébergée par Next.js
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: "Qubik — La marketplace Roblox", template: "%s · Qubik" },
  description: "Achète et vends des scripts, modèles et systèmes Roblox. Chaque ressource est scannée contre les backdoors.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Pastille « Modération » : seulement calculée pour les admins
  const pendingCount = user?.role === "ADMIN" ? await db.resource.count({ where: { status: "PENDING" } }) : 0;

  return (
    <html lang="fr" className={jakarta.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Navbar user={user ? { username: user.username, role: user.role } : null} pendingCount={pendingCount} />

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
