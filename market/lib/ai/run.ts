import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";
import { grantFounderIfEligible } from "@/lib/sellers";
import { promoteVersion } from "@/lib/versions";
import { hasRobloxContent, type ScanReport } from "@/lib/scan";
import { buildDigest } from "./digest";
import { links, notify, notifyAdmins } from "@/lib/notifications";
import { AiError, analyzeWithAi } from "./ovh";
import { activeProviders, type Provider, type ProviderId } from "./providers";

// File d'attente des analyses IA.
// Chaque version à analyser reçoit aiStatus « QUEUED » (aiAt = son heure d'arrivée dans la file).
// Un seul serveur à la fois traite la file (verrou « ai-queue »), avec plusieurs fournisseurs en même temps
// (OVH, Pollinations, LLM7 : voir providers.ts). Chacun prend la prochaine version de la file à son rythme
// (OVH sans clé : une toutes les 31 s ; Pollinations : 31 s ; LLM7 : 61 s, avec un petit quota par jour).
// Un fournisseur saturé ou en panne fait une pause (le temps qu'il demande, sinon 2 min), et la version
// qu'il traitait retourne en tête de file pour les autres.
// La file avance à chaque publication, à chaque visite de Mon espace ou de la modération
// (la page du vendeur se recharge toute seule tant qu'il attend) et une fois par jour (tâche Vercel).
//
// Après l'analyse :
// - ressource ou version « ANALYZING » (scan propre, en attente de l'IA) :
//     notes correctes → en ligne ; signalée → en modération ; analyse impossible → en modération
// - sinon (ressource déjà en ligne, ou scan « à vérifier ») : on enregistre seulement le résultat ;
//     un signalement d'une ressource en ligne apparaît dans la page de modération

export const AI_THRESHOLD = 50; // sous cette note (correspondance, qualité ou description), la ressource est signalée
const AVG_ANALYSIS_MS = 12_000; // durée moyenne d'une analyse (pour l'estimation affichée)
const START_BUDGET_MS = 60_000; // plus de nouvelle analyse après 60 s (une analyse dure 45 s au plus, maxDuration = 120 s)
const LEASE_MS = 150_000; // le verrou expire tout seul si le serveur s'arrête en plein milieu
const BUSY_PAUSE_MS = 120_000; // fournisseur saturé sans « Retry-After » : pause de 2 minutes
const MAX_BUSY_ATTEMPTS = 40; // fournisseurs saturés : on réessaie longtemps avant d'abandonner
const MAX_ERROR_ATTEMPTS = 4; // erreur qui ne vient pas de la saturation (fichier illisible, réponse invalide…)

// provider : le fournisseur qui a fait l'analyse (affiché dans la modération)
export type AiReport = { summary: string; findings: { level: "ok" | "warn" | "bad"; text: string }[]; tips: string[]; provider?: ProviderId };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Ajout à la file ----------

export async function enqueueAnalysis(versionIds: string | string[], language: "fr" | "en") {
  await db.resourceVersion.updateMany({
    where: { id: { in: typeof versionIds === "string" ? [versionIds] : versionIds } },
    data: { aiStatus: "QUEUED", aiAt: new Date(), aiLanguage: language, aiAttempts: 0 },
  });
}

// Fait avancer la file après la réponse envoyée au visiteur (à appeler pendant une requête)
export function kickAiQueue() {
  after(() => processAiQueue().catch((err) => console.error("File d'analyse IA :", err)));
}

// ---------- Position dans la file ----------

export type QueueSpot = { position: number; waitSeconds: number }; // position 0 = analyse en cours

export async function queueSpots(versionIds: string[]): Promise<Map<string, QueueSpot>> {
  const spots = new Map<string, QueueSpot>();
  if (versionIds.length === 0) return spots;
  const queue = await db.resourceVersion.findMany({
    where: { aiStatus: { in: ["QUEUED", "PENDING"] } },
    orderBy: { aiAt: "asc" },
    select: { id: true, aiStatus: true },
  });
  // Les fournisseurs travaillent en même temps : leurs rythmes s'additionnent
  const perMinute = activeProviders().reduce((sum, p) => sum + 60_000 / Math.max(p.gapMs, AVG_ANALYSIS_MS), 0);
  const perItem = 60 / perMinute;
  let position = 0;
  for (const item of queue) {
    if (item.aiStatus === "QUEUED") position++;
    if (versionIds.includes(item.id)) {
      const p = item.aiStatus === "PENDING" ? 0 : position;
      spots.set(item.id, { position: p, waitSeconds: Math.round((p + 0.5) * perItem) });
    }
  }
  return spots;
}

export async function queueLength() {
  return db.resourceVersion.count({ where: { aiStatus: { in: ["QUEUED", "PENDING"] } } });
}

// ---------- Réanalyses des ressources déjà en ligne ----------

// Versions en ligne remises dans la file (bouton « Réanalyser », texte modifié…). Les nouvelles publications
// et nouvelles versions (statut « ANALYZING ») n'en font pas partie : elles attendent l'IA pour passer en ligne.
const LIVE_REANALYSIS = {
  aiStatus: { in: ["QUEUED", "PENDING"] },
  status: { not: "ANALYZING" },
  resource: { status: { in: ["APPROVED", "UNLISTED"] } },
};

export async function liveReanalysisCount() {
  return db.resourceVersion.count({ where: LIVE_REANALYSIS });
}

// Retire ces versions de la file : elles retrouvent leur résultat précédent (ou aucun si elles n'en avaient pas).
// Une analyse déjà partie chez OVH ne peut pas être coupée : son résultat s'enregistrera quand même.
export async function stopLiveReanalyses() {
  const [withResult, without] = await db.$transaction([
    db.resourceVersion.updateMany({ where: { ...LIVE_REANALYSIS, aiReport: { not: null } }, data: { aiStatus: "DONE", aiAttempts: 0 } }),
    db.resourceVersion.updateMany({ where: { ...LIVE_REANALYSIS, aiReport: null }, data: { aiStatus: null, aiAttempts: 0 } }),
  ]);
  return withResult.count + without.count;
}

// ---------- Traitement ----------

async function acquireLease() {
  const now = new Date();
  const until = new Date(now.getTime() + LEASE_MS);
  const { count } = await db.lease.updateMany({ where: { name: "ai-queue", until: { lt: now } }, data: { until } });
  if (count === 1) return true;
  try {
    await db.lease.create({ data: { name: "ai-queue", until } });
    return true;
  } catch {
    return false; // un autre serveur traite déjà la file
  }
}

async function releaseLease() {
  await db.lease.updateMany({ where: { name: "ai-queue" }, data: { until: new Date(0) } });
}

// Prochain moment où un fournisseur peut lancer une analyse (gardé en base : vaut aussi pour le passage suivant)
const slotName = (p: Provider) => `ai-next:${p.id}`;

async function nextSlot(p: Provider) {
  const row = await db.lease.findUnique({ where: { name: slotName(p) } });
  return row?.until.getTime() ?? 0;
}

async function setNextSlot(p: Provider, at: number) {
  const until = new Date(at);
  await db.lease.upsert({ where: { name: slotName(p) }, update: { until }, create: { name: slotName(p), until } });
}

// Prend la prochaine version de la file pour soi (deux fournisseurs ne prennent jamais la même)
async function claimNext() {
  for (let i = 0; i < 5; i++) {
    const next = await db.resourceVersion.findFirst({ where: { aiStatus: "QUEUED" }, orderBy: { aiAt: "asc" }, include: { resource: true } });
    if (!next) return null;
    const { count } = await db.resourceVersion.updateMany({ where: { id: next.id, aiStatus: "QUEUED" }, data: { aiStatus: "PENDING", aiAttempts: { increment: 1 } } });
    if (count === 1) return next;
  }
  return null;
}

// Un fournisseur : il analyse les versions de la file une par une, à son rythme, jusqu'à la fin du temps du passage
async function worker(provider: Provider, start: number) {
  while (true) {
    const wait = Math.max(0, (await nextSlot(provider)) - Date.now());
    if (Date.now() + wait - start > START_BUDGET_MS) return; // la suite au prochain passage
    if (wait > 0) await sleep(wait);

    const next = await claimNext();
    if (!next) return;
    await setNextSlot(provider, Date.now() + provider.gapMs);
    try {
      const bytes = new Uint8Array(await readUpload(next.filePath));
      const digest = buildDigest(bytes, next.fileName);
      const input = {
        title: next.resource.title,
        summary: next.resource.summary,
        description: next.resource.description,
        category: next.resource.category,
        digest,
        language: next.aiLanguage === "en" ? ("en" as const) : ("fr" as const),
      };
      const result = await analyzeWithAi(input, provider);
      await applyResult(next.id, result, provider.id);
    } catch (err) {
      // Fournisseur saturé, panne passagère ou délai dépassé : la version garde sa place en tête de file
      // pour les autres fournisseurs, et celui-ci fait une pause
      const busy = err instanceof AiError && err.retryable;
      const attempts = next.aiAttempts + 1;
      console.error(`Analyse IA ${provider.name} (version ${next.id}, essai ${attempts}) :`, (err as Error).message);
      if (attempts >= (busy ? MAX_BUSY_ATTEMPTS : MAX_ERROR_ATTEMPTS)) {
        await applyResult(next.id, null);
      } else {
        await db.resourceVersion.update({ where: { id: next.id }, data: { aiStatus: "QUEUED", ...(!busy && { aiAt: new Date() }) } });
      }
      if (busy) {
        const pause = err instanceof AiError && err.retryAfterMs ? err.retryAfterMs : BUSY_PAUSE_MS;
        await setNextSlot(provider, Date.now() + Math.max(pause, provider.gapMs));
        return;
      }
    }
  }
}

export async function processAiQueue() {
  if (!(await acquireLease())) return;
  try {
    // Le verrou était libre : une analyse « en cours » a forcément été interrompue, elle reprend sa place
    await db.resourceVersion.updateMany({ where: { aiStatus: "PENDING" }, data: { aiStatus: "QUEUED" } });
    const start = Date.now();
    await Promise.all(activeProviders().map((p) => worker(p, start)));
  } finally {
    await releaseLease();
  }
}

// Enregistre le résultat d'une analyse (null = analyse impossible) et décide de la suite
async function applyResult(versionId: string, result: Awaited<ReturnType<typeof analyzeWithAi>> | null, provider?: ProviderId) {
  // Signalée si une des trois notes est sous le seuil (contenu, qualité ou description incomplète)
  const flagged = result ? result.match < AI_THRESHOLD || result.quality < AI_THRESHOLD || result.description < AI_THRESHOLD : null;
  const report: AiReport | null = result ? { summary: result.summary, findings: result.findings, tips: result.tips, provider } : null;

  // Ce qui s'est passé, pour prévenir le vendeur et les modérateurs après coup
  let outcome: "resource" | "version" | "live" | null = null;
  const version = await db.$transaction(async (tx) => {
    const version = await tx.resourceVersion.update({
      where: { id: versionId },
      data: {
        aiStatus: result ? "DONE" : "FAILED",
        aiMatch: result?.match ?? null,
        aiQuality: result?.quality ?? null,
        aiDescription: result?.description ?? null,
        aiFlagged: flagged,
        aiReport: report ? JSON.stringify(report) : null,
        aiAt: new Date(),
        aiReviewed: false,
      },
      include: { resource: true },
    });
    const resource = version.resource;
    const passed = flagged === false; // analyse faite et rien de signalé

    if (resource.status === "ANALYZING" && resource.version === version.version) {
      // Nouvelle publication au scan propre : en ligne si l'IA est d'accord, sinon un modérateur décide
      await tx.resource.update({ where: { id: resource.id }, data: { status: passed ? "APPROVED" : "PENDING", aiVerified: passed } });
      await tx.resourceVersion.update({ where: { id: version.id }, data: { status: passed ? "LIVE" : "PENDING" } });
      outcome = "resource";
    } else if (version.status === "ANALYZING") {
      // Nouvelle version au scan propre d'une ressource en ligne
      if (passed) await promoteVersion(tx, version.id, true);
      else await tx.resourceVersion.update({ where: { id: version.id }, data: { status: "PENDING" } });
      outcome = "version";
    } else if (resource.version === version.version && (resource.status === "APPROVED" || resource.status === "UNLISTED")) {
      // Réanalyse de la version en ligne : seul le badge change (un signalement va dans la modération)
      await tx.resource.update({ where: { id: resource.id }, data: { aiVerified: passed } });
      outcome = "live";
    }
    return version;
  });

  // Notifications : en ligne, ou envoyée en vérification (raison : description incomplète ou contenu)
  const resource = version.resource;
  const passed = flagged === false;
  const reason = result && result.match >= AI_THRESHOLD && result.quality >= AI_THRESHOLD ? "description" : "content";
  const data = { title: resource.title, version: version.version, reason } as const;
  if (outcome === "resource") {
    await notify(resource.sellerId, passed ? "RES_LIVE" : "RES_HELD", data, passed ? links.resource(resource.slug) : links.report(resource.id));
    if (!passed) await notifyAdmins("MOD_PENDING", data, "/admin/queue");
  } else if (outcome === "version") {
    await notify(resource.sellerId, passed ? "VER_LIVE" : "VER_HELD", data, links.versions(resource.id));
    if (!passed) await notifyAdmins("MOD_PENDING", data, "/admin/queue");
  } else if (outcome === "live" && flagged) {
    await notifyAdmins("MOD_FLAG", data, "/admin/flags");
  }

  const now = await db.resource.findUnique({ where: { id: version.resourceId }, select: { status: true, sellerId: true } });
  if (now?.status === "APPROVED") await grantFounderIfEligible(now.sellerId);

  revalidatePath(`/resources/${version.resource.slug}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/");
}

// ---------- Anciennes ressources ----------

// Ressources jamais analysées (publiées avant l'analyse IA) ou dont l'analyse a échoué
// (seulement les fichiers avec du contenu Roblox : l'IA ne peut pas analyser une image, un son ou un modèle 3D)
export async function findUnanalyzedVersionIds() {
  const resources = await db.resource.findMany({
    where: { status: { in: ["APPROVED", "UNLISTED", "PENDING"] } },
    select: { version: true, versions: { where: { OR: [{ aiStatus: null }, { aiStatus: "FAILED" }] }, select: { id: true, version: true, scanReport: true } } },
  });
  return resources.flatMap((r) =>
    r.versions.filter((v) => v.version === r.version && hasRobloxContent(JSON.parse(v.scanReport) as ScanReport)).map((v) => v.id),
  );
}

export function parseAiReport(raw: string | null): AiReport | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiReport;
  } catch {
    return null;
  }
}
