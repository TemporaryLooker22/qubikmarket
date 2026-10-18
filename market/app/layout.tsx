import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderationCounts } from "@/lib/moderation";
import { getDictionary } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SourceTracker } from "@/components/SourceTracker";
import { Analytics } from "@vercel/analytics/next";
import { DEMO_ENABLED } from "@/lib/demo";
import "./globals.css";

// Police du site : Plus Jakarta Sans, chargée et hébergée par Next.js
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    title: { default: t.meta.title, template: "%s · Qubik" },
    description: t.meta.description,
    // Mode démo : faux produits et images d'autres créateurs, on demande à Google de ne pas indexer le site
    ...(DEMO_ENABLED && { robots: { index: false, follow: false } }),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, { locale, t }] = await Promise.all([getCurrentUser(), getDictionary()]);
  // Pastille « Modération » : seulement calculée pour les admins
  // (éléments à vérifier + signalements de l'IA + avis signalés, voir lib/moderation.ts)
  const pendingCount = user?.role === "ADMIN" ? await moderationCounts().then((c) => c.queue + c.flags + c.reports) : 0;
  // Cloche : notifications non lues (la liste se charge au clic)
  const unreadCount = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  // Le menu du compte propose « Devenir vendeur » à ceux qui n'ont encore rien publié
  const isSeller = user ? (await db.resource.count({ where: { sellerId: user.id } })) > 0 : false;

  return (
    <html lang={locale} className={jakarta.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <LocaleProvider locale={locale}>
          <Navbar user={user ? { username: user.username, email: user.email, role: user.role, isSeller } : null} pendingCount={pendingCount} unreadCount={unreadCount} />

          <main className="flex-1 pb-16">{children}</main>

          <footer className="border-t border-border">
            <div className="container-q flex flex-wrap justify-between gap-3 py-6 text-xs text-muted">
              <span>© {new Date().getFullYear()} Qubik · {t.footer.rights}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{t.footer.scanned}</span>
                <Link href="/become-seller" className="hover:text-text">
                  {t.footer.becomeSeller}
                </Link>
                <Link href="/terms" className="hover:text-text">
                  {t.footer.terms}
                </Link>
                <Link href="/privacy" className="hover:text-text">
                  {t.footer.privacy}
                </Link>
              </span>
            </div>
          </footer>
        </LocaleProvider>
        {/* Statistiques de visite sans cookie (Vercel Web Analytics) et provenance des inscriptions */}
        <Analytics />
        <SourceTracker />
      </body>
    </html>
  );
}
