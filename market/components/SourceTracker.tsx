"use client";

import { useEffect } from "react";

// Provenance d'un visiteur, notée à sa première page (pour savoir quel lien amène les inscriptions) :
// le site qui l'a envoyé (Discord, YouTube, Google…), une campagne (?utm_source=… ou ?ref=…) et la page d'arrivée.
// Gardée seulement le temps de l'onglet (sessionStorage) et envoyée avec le formulaire d'inscription.
const KEY = "qubik_source";

export type VisitSource = { source: string; referrer: string; landing: string };

export function SourceTracker() {
  useEffect(() => {
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
      const value: VisitSource = { source, referrer, landing: url.pathname.slice(0, 120) };
      sessionStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      // stockage indisponible (navigation privée stricte) : tant pis
    }
  }, []);
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
