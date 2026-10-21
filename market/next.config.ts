import type { NextConfig } from "next";

// En production, les fichiers du site (scripts, polices, images optimisées) sont servis depuis l'adresse Vercel.
// Si un antivirus ou un filtre bloque qubikmarket.com par erreur (ex. Kaspersky sur un domaine récent), la page
// reste utilisable : les styles sont dans la page elle-même (inlineCss) et le reste vient d'une autre adresse.
const ASSETS = process.env.VERCEL_ENV === "production" ? "https://qubikmarket.vercel.app" : undefined;

const nextConfig: NextConfig = {
  assetPrefix: ASSETS,
  // Captures d'écran des ressources, stockées sur Vercel Blob
  images: {
    ...(ASSETS && { path: `${ASSETS}/_next/image` }),
    // Moins de tailles différentes (7 au lieu de 16) et gardées 31 jours : Vercel relit moins souvent
    // les images d'origine dans Vercel Blob (transfert limité sur le plan gratuit)
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [128, 256, 384],
    minimumCacheTTL: 31 * 24 * 60 * 60,
    // + miniatures des vidéos YouTube de présentation
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  experimental: {
    // Autorise l'envoi de fichiers jusqu'à 4 Mo dans les formulaires (+ marge pour les autres champs)
    serverActions: { bodySizeLimit: "4.4mb" },
    // Styles écrits directement dans la page : la mise en page ne dépend pas d'un fichier à télécharger en plus
    inlineCss: true,
  },
  // Une seule adresse pour le site : qubikmarket.com
  async redirects() {
    return [
      // www.qubikmarket.com → qubikmarket.com
      { source: "/:path*", has: [{ type: "host", value: "www.qubikmarket.com" }], destination: "https://qubikmarket.com/:path*", permanent: true },
      // Pages de l'ancienne adresse Vercel → qubikmarket.com. Restent sur place : /api (webhook Stripe déclaré
      // dessus) et les fichiers (avec un point : logo, images…), servis à qubikmarket.com depuis cette adresse.
      {
        source: "/:path((?!api/)[^.]*)",
        has: [{ type: "host", value: "qubikmarket.vercel.app" }],
        destination: "https://qubikmarket.com/:path",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
