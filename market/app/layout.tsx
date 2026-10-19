import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { moderationCounts } from "@/lib/moderation";
import { pendingModeratorMessage, unreadConversations } from "@/lib/chat";
import { ModeratorNotice } from "@/components/chat/ModeratorNotice";
import { PublishPauseNotice } from "@/components/PublishPauseNotice";
import { formatPauseEnd, publishPause } from "@/lib/publish-pause";
import { getDictionary } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { SourceTracker } from "@/components/SourceTracker";
import { Suspense } from "react";
import { after } from "next/server";
import { headers } from "next/headers";
import { botName, recordBotView } from "@/lib/analytics";
import { Analytics } from "@vercel/analytics/next";
import { DEMO_ENABLED } from "@/lib/demo";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Police du site : Plus Jakarta Sans, chargée et hébergée par Next.js
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t.meta.title, template: "%s · Qubik" },
    description: t.meta.description,
    applicationName: SITE_NAME,
    openGraph: { type: "website", siteName: SITE_NAME, title: t.meta.title, description: t.meta.description, url: SITE_URL },
    twitter: { card: "summary_large_image", title: t.meta.title, description: t.meta.description },
    // Mode démo : faux produits et images d'autres créateurs, on demande à Google de ne pas indexer le site
    ...(DEMO_ENABLED && { robots: { index: false, follow: false } }),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, { locale, t }, requestHeaders] = await Promise.all([getCurrentUser(), getDictionary(), headers()]);
  // Statistiques : les robots (Google…) n'exécutent pas toujours la page, on les compte ici, côté serveur
  const bot = botName(requestHeaders.get("user-agent") ?? "");
  if (bot) {
    const copy = new Headers(requestHeaders);
    after(() => recordBotView(bot, copy).catch(() => {}));
  }
  // Pastille « Modération » : seulement calculée pour les admins
  // (éléments à vérifier + signalements de l'IA + avis signalés, voir lib/moderation.ts)
  const pendingCount = user?.role === "ADMIN" ? await moderationCounts().then((c) => c.queue + c.flags + c.reports + c.chats) : 0;
  // Cloche : notifications non lues (la liste se charge au clic)
  const unreadCount = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  // Icône Messages : conversations avec des messages non lus
  const chatUnread = user ? await unreadConversations(user.id) : 0;
  // Le menu du compte propose « Devenir vendeur » à ceux qui n'ont encore rien publié
  const isSeller = user ? (await db.resource.count({ where: { sellerId: user.id } })) > 0 : false;
  // Message d'un modérateur pas encore lu : affiché dans une fenêtre dès l'arrivée sur le site
  const moderatorNotice = user && user.role !== "ADMIN" ? await pendingModeratorMessage(user.id) : null;
  // Pause de publication pas encore vue : fenêtre d'information (une seule fois par pause)
  const pause = user ? await publishPause(user.id) : null;
  const pauseNotice = pause && !pause.seen ? formatPauseEnd(pause.until, locale) : null;

  return (
    <html lang={locale} className={jakarta.variable}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <LocaleProvider locale={locale}>
          <Navbar user={user ? { username: user.username, email: user.email, role: user.role, isSeller, avatarUrl: user.avatarUrl } : null} pendingCount={pendingCount} unreadCount={unreadCount} chatUnread={chatUnread} />

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
        <ModeratorNotice notice={moderatorNotice} />
        {!moderatorNotice && <PublishPauseNotice until={pauseNotice} />}
        <Suspense fallback={null}>
          <SourceTracker />
        </Suspense>
      </body>
    </html>
  );
}
