import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { Navbar } from "@/components/Navbar";
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
  const pendingCount = user?.role === "ADMIN" ? await db.resource.count({ where: { status: "PENDING" } }) : 0;

  return (
    <html lang={locale} className={jakarta.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <LocaleProvider locale={locale}>
          <Navbar user={user ? { username: user.username, role: user.role } : null} pendingCount={pendingCount} />

          <main className="flex-1 pb-16">{children}</main>

          <footer className="border-t border-border">
            <div className="container-q flex flex-wrap justify-between gap-3 py-6 text-xs text-muted">
              <span>© {new Date().getFullYear()} Qubik · {t.footer.rights}</span>
              <span>{t.footer.scanned}</span>
            </div>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
