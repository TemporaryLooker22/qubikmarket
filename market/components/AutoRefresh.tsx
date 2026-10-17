"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Recharge les données de la page toutes les quelques secondes (sans recharger la page entière),
// par exemple tant qu'une ressource attend dans la file de vérification IA
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
