"use client";

import { useEffect, useRef } from "react";

// Sur téléphone, les menus d'onglets défilent de côté : on centre l'onglet actif pour qu'il soit visible
// (sans faire défiler la page, seulement la rangée d'onglets).
export function useActiveTabScroll<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const nav = ref.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const offset = active.getBoundingClientRect().left - nav.getBoundingClientRect().left;
    nav.scrollLeft += offset - (nav.clientWidth - active.offsetWidth) / 2;
  }, [key]);
  return ref;
}
