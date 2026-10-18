import "server-only";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";
import { grantFounderIfEligible } from "@/lib/sellers";
import { promoteVersion } from "@/lib/versions";
import { hasRobloxContent, type ScanReport } from "@/lib/scan";
import { buildDigest } from "./digest";
import { AiError, analyzeWithAi, hasAiKey } from "./ovh";

// File d'attente des analyses IA.
// Chaque version à analyser reçoit aiStatus « QUEUED » (aiAt = son heure d'arrivée dans la file).
// Un seul serveur à la fois traite la file (verrou « ai-queue »), une analyse après l'autre :
// sans clé OVH, on attend 30 s entre deux analyses (limite de 2 par minute).
// La file avance à chaque publication, à chaque visite de Mon espace ou de la modération
// (la page du vendeur se recharge toute seule tant qu'il attend) et une fois par jour (tâche Vercel).
//
// Après l'analyse :
// - ressource ou version « ANALYZING » (scan propre, en attente de l'IA) :
//     notes correctes → en ligne ; signalée → en modération ; analyse impossible → en modération
// - sinon (ressource déjà en ligne, ou scan « à vérifier ») : on enregistre seulement le résultat ;
//     un signalement d'une ressource en ligne apparaît dans la page de modération

export const AI_THRESHOLD = 50; // sous cette note (correspondance, qualité ou description), la ressource est signalée
const KEYLESS_GAP_MS = 31_000; // sans clé : 2 analyses par minute au plus
const WITH_KEY_SECONDS = 10; // durée moyenne d'une analyse avec clé (pour l'estimation affichée)
const START_BUDGET_MS = 60_000; // plus de nouvelle analyse après 60 s (une analyse dure 45 s au plus, maxDuration = 120 s)
const LEASE_MS = 150_000; // le verrou expire tout seul si le serveur s'arrête en plein milieu
const MAX_BUSY_ATTEMPTS = 40; // OVH saturé : on réessaie longtemps avant d'abandonner
const MAX_ERROR_ATTEMPTS = 3; // erreur qui ne vient pas de la saturation (fichier illisible, réponse invalide…)

export type AiReport = { summary: string; findings: { level: "ok" | "warn" | "bad"; text: string }[]; tips: string[] };

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
  const perItem = hasAiKey() ? WITH_KEY_SECONDS : KEYLESS_GAP_MS / 1000;
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

export async function processAiQueue() {
  if (!(await acquireLease())) return;
  try {
    // Le verrou était libre : une analyse « en cours » a forcément été interrompue, elle reprend sa place
    await db.resourceVersion.updateMany({ where: { aiStatus: "PENDING" }, data: { aiStatus: "QUEUED" } });

    const start = Date.now();
    // Dernière analyse terminée (passage précédent) : le délai de 30 s sans clé compte depuis elle
    const last = await db.resourceVersion.findFirst({ where: { aiStatus: { in: ["DONE", "FAILED"] } }, orderBy: { aiAt: "desc" }, select: { aiAt: true } });
    let lastCall = last?.aiAt?.getTime() ?? 0;
    while (true) {
      const next = await db.resourceVersion.findFirst({ where: { aiStatus: "QUEUED" }, orderBy: { aiAt: "asc" }, include: { resource: true } });
      if (!next) break;

      // Sans clé : on respecte la limite de 2 analyses par minute
      const wait = !hasAiKey() && lastCall ? lastCall + KEYLESS_GAP_MS - Date.now() : 0;
      if (Date.now() + wait - start > START_BUDGET_MS) break; // la suite au prochain passage
      if (wait > 0) await sleep(wait);

      await db.resourceVersion.update({ where: { id: next.id }, data: { aiStatus: "PENDING", aiAttempts: { increment: 1 } } });
      try {
        const bytes = new Uint8Array(await readUpload(next.filePath));
        const digest = buildDigest(bytes, next.fileName);
        lastCall = Date.now();
        const result = await analyzeWithAi({
          title: next.resource.title,
          summary: next.resource.summary,
          description: next.resource.description,
          category: next.resource.category,
          digest,
          language: next.aiLanguage === "en" ? "en" : "fr",
        });
        await applyResult(next.id, result);
      } catch (err) {
        // Saturation d'OVH, panne passagère ou délai dépassé : la version garde sa place
        const busy = err instanceof AiError && err.retryable;
        const attempts = next.aiAttempts + 1;
        console.error(`Analyse IA (version ${next.id}, essai ${attempts}) :`, (err as Error).message);
        if (attempts >= (busy ? MAX_BUSY_ATTEMPTS : MAX_ERROR_ATTEMPTS)) {
          await applyResult(next.id, null);
        } else {
          await db.resourceVersion.update({ where: { id: next.id }, data: { aiStatus: "QUEUED", ...(!busy && { aiAt: new Date() }) } });
        }
        if (busy) break; // on réessaiera au prochain passage
      }
    }
  } finally {
    await releaseLease();
  }
}

// Enregistre le résultat d'une analyse (null = analyse impossible) et décide de la suite
async function applyResult(versionId: string, result: Awaited<ReturnType<typeof analyzeWithAi>> | null) {
  // Signalée si une des trois notes est sous le seuil (contenu, qualité ou description incomplète)
  const flagged = result ? result.match < AI_THRESHOLD || result.quality < AI_THRESHOLD || result.description < AI_THRESHOLD : null;
  const report: AiReport | null = result ? { summary: result.summary, findings: result.findings, tips: result.tips } : null;

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
    } else if (version.status === "ANALYZING") {
      // Nouvelle version au scan propre d'une ressource en ligne
      if (passed) await promoteVersion(tx, version.id, true);
      else await tx.resourceVersion.update({ where: { id: version.id }, data: { status: "PENDING" } });
    } else if (resource.version === version.version && (resource.status === "APPROVED" || resource.status === "UNLISTED")) {
      // Réanalyse de la version en ligne : seul le badge change (un signalement va dans la modération)
      await tx.resource.update({ where: { id: resource.id }, data: { aiVerified: passed } });
    }
    return version;
  });

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
