"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

// Provenance d'un visiteur, notée à sa première page (pour savoir quel lien amène les inscriptions) :
// le site qui l'a envoyé (Discord, YouTube, Google…), une campagne (?utm_source=… ou ?ref=…) et la page d'arrivée.
// Gardée seulement le temps de l'onglet (sessionStorage) et envoyée avec le formulaire d'inscription.
// Chaque page vue est aussi envoyée aux statistiques du site (sans cookie, voir lib/analytics.ts).
const KEY = "qubik_source";

export type VisitSource = { source: string; referrer: string; landing: string; campaign?: string };

function noteSource() {
  try {
    if (sessionStorage.getItem(KEY)) return; // on garde la toute première provenance
    const url = new URL(location.href);
    const campaign = url.searchParams.get("utm_source") || url.searchParams.get("ref");
    let referrer = "";
    try {
      const ref = new URL(document.referrer);
      if (ref.host !== location.host) referrer = `${ref.host}${ref.pathname}`.slice(0, 200);
    } catch {
      // pas de site d'origine (lien tapé ou favori)
    }
    const source = campaign ? campaign.toLowerCase().slice(0, 60) : referrer ? referrer.split("/")[0].replace(/^www\./, "") : "direct";
    const value: VisitSource = { source, referrer, landing: url.pathname.slice(0, 120), ...(campaign && { campaign: campaign.toLowerCase().slice(0, 60) }) };
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // stockage indisponible (navigation privée stricte) : tant pis
  }
}

// Page précédente sur le site (pour savoir d'où l'on arrive sur une ressource : catalogue, recherche, accueil…)
let previous: string | null = null;

function sendPageView() {
  const current = location.pathname + location.search;
  let prev = previous;
  if (prev === null) {
    // Première page de l'onglet : on vient peut-être quand même du site (lien classique, rechargement)
    try {
      const ref = new URL(document.referrer);
      if (ref.host === location.host) prev = ref.pathname + ref.search;
    } catch {
      // arrivée depuis un autre site ou un lien tapé
    }
  }
  previous = current;
  if (prev === current) prev = null;
  let visit: Partial<VisitSource> = {};
  try {
    visit = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    // provenance inconnue
  }
  const body = JSON.stringify({
    path: current,
    prev: prev ?? undefined,
    source: visit.source ?? "direct",
    referrer: visit.referrer ? visit.referrer.split("/")[0] : undefined,
    campaign: visit.campaign,
    locale: document.documentElement.lang,
  });
  try {
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "text/plain" }))) {
      fetch("/api/track", { method: "POST", body, keepalive: true }).catch(() => {});
    }
  } catch {
    // statistiques indisponibles : sans importance pour le visiteur
  }
}

export function SourceTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    noteSource();
    sendPageView();
  }, [pathname, search]);
  return null;
}

// Lue par le formulaire d'inscription
export function readVisitSource(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
