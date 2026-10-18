import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Captures d'écran des ressources, stockées sur Vercel Blob
  images: {
    // + miniatures des vidéos YouTube de présentation
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  experimental: {
    // Autorise l'envoi de fichiers jusqu'à 4 Mo dans les formulaires (+ marge pour les autres champs)
    serverActions: { bodySizeLimit: "4.4mb" },
  },
  // Une seule adresse pour le site : qubikmarket.com
  async redirects() {
    return [
      // www.qubikmarket.com → qubikmarket.com
      { source: "/:path*", has: [{ type: "host", value: "www.qubikmarket.com" }], destination: "https://qubikmarket.com/:path*", permanent: true },
      // Ancienne adresse Vercel → qubikmarket.com, sauf /api : le webhook Stripe y est encore déclaré
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: "qubikmarket.vercel.app" }],
        destination: "https://qubikmarket.com/:path",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
