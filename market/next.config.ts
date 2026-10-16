import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Autorise l'envoi de fichiers jusqu'à 4 Mo dans les formulaires (+ marge pour les autres champs)
    serverActions: { bodySizeLimit: "4.4mb" },
  },
};

export default nextConfig;
