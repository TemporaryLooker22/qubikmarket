import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Autorise l'envoi de fichiers jusqu'à 25 Mo dans les formulaires
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
