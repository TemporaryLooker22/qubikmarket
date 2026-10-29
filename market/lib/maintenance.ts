import "server-only";
import { cache } from "react";
import { db } from "./db";

// Mode maintenance (Modération → Vue d'ensemble, propriétaire du site) : les visiteurs voient une page
// « Site en maintenance » à la place du site. Les modérateurs gardent l'accès complet.
// Restent ouverts pour tout le monde : la connexion, les conditions et la confidentialité, et toutes les routes /api
// (webhooks Stripe, tâches planifiées, connexion Google/Discord), voir app/layout.tsx et middleware.ts.

const KEY = "maintenance";
export const MAINTENANCE_OPEN_PATHS = ["/login", "/terms", "/privacy"];

export type Maintenance = { message: string | null; since: Date };

// Lu une seule fois par requête (cache de React)
export const maintenanceState = cache(async (): Promise<Maintenance | null> => {
  const row = await db.siteSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  if (!row) return null;
  try {
    const value = JSON.parse(row.value) as { on?: boolean; message?: string | null; since?: string };
    return value.on ? { message: value.message || null, since: new Date(value.since ?? Date.now()) } : null;
  } catch {
    return null;
  }
});

export async function setMaintenance(on: boolean, message: string | null) {
  const value = JSON.stringify({ on, message, since: new Date().toISOString() });
  await db.siteSetting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}

export function isOpenDuringMaintenance(pathname: string) {
  return MAINTENANCE_OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
