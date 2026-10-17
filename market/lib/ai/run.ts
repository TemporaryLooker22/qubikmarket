import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";
import { grantFounderIfEligible } from "@/lib/sellers";
import { promoteVersion } from "@/lib/versions";
import { buildDigest } from "./digest";
import { AiError, analyzeWithAi } from "./ovh";

// Analyse IA d'une version (lancée en arrière-plan après une publication, une nouvelle version,
// une modification du texte, ou depuis la page de modération), puis décision :
// - ressource ou version « ANALYZING » (scan propre, en attente de l'IA) :
//     notes correctes → en ligne ; signalée → en modération ; IA indisponible → en ligne quand même (scan propre)
// - sinon (ressource déjà en ligne, ou scan « à vérifier ») : on enregistre seulement le résultat ;
//     un signalement d'une ressource en ligne apparaît dans la page de modération

export const AI_THRESHOLD = 50; // sous cette note (correspondance ou qualité), la ressource est signalée
const RETRY_DELAYS_MS = [0, 20_000, 40_000]; // sans clé OVH : 2 requêtes par minute

export type AiReport = { summary: string; findings: { level: "ok" | "warn" | "bad"; text: string }[]; tips: string[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function analyzeVersion(versionId: string, language: "fr" | "en") {
  const version = await db.resourceVersion.findUnique({ where: { id: versionId }, include: { resource: true } });
  if (!version) return;
  const resource = version.resource;
  // aiAt = début de l'analyse (si elle reste « PENDING » trop longtemps, elle est considérée comme bloquée)
  await db.resourceVersion.update({ where: { id: version.id }, data: { aiStatus: "PENDING", aiAt: new Date() } });

  // 1. Analyse, avec de nouveaux essais si OVH est saturé
  let result: Awaited<ReturnType<typeof analyzeWithAi>> | null = null;
  let attempts = 0;
  for (const delay of RETRY_DELAYS_MS) {
    await sleep(delay);
    attempts++;
    try {
      const bytes = new Uint8Array(await readUpload(version.filePath));
      const digest = buildDigest(bytes, version.fileName);
      result = await analyzeWithAi({
        title: resource.title,
        summary: resource.summary,
        description: resource.description,
        category: resource.category,
        digest,
        language,
      });
      break;
    } catch (err) {
      console.error(`Analyse IA (version ${version.id}, essai ${attempts}) :`, (err as Error).message);
      if (!(err instanceof AiError && err.retryable)) break;
    }
  }

  const flagged = result ? result.match < AI_THRESHOLD || result.quality < AI_THRESHOLD : null;
  const report: AiReport | null = result ? { summary: result.summary, findings: result.findings, tips: result.tips } : null;

  await db.$transaction(async (tx) => {
    await tx.resourceVersion.update({
      where: { id: version.id },
      data: {
        aiStatus: result ? "DONE" : "FAILED",
        aiMatch: result?.match ?? null,
        aiQuality: result?.quality ?? null,
        aiFlagged: flagged,
        aiReport: report ? JSON.stringify(report) : null,
        aiAt: new Date(),
        aiAttempts: { increment: attempts },
        aiReviewed: false,
      },
    });

    // 2. Décision
    const current = await tx.resource.findUniqueOrThrow({ where: { id: resource.id } });
    if (current.status === "ANALYZING" && current.version === version.version) {
      // Nouvelle publication au scan propre
      if (flagged) {
        await tx.resource.update({ where: { id: resource.id }, data: { status: "PENDING", aiVerified: false } });
        await tx.resourceVersion.update({ where: { id: version.id }, data: { status: "PENDING" } });
      } else {
        await tx.resource.update({ where: { id: resource.id }, data: { status: "APPROVED", aiVerified: flagged === false } });
        await tx.resourceVersion.update({ where: { id: version.id }, data: { status: "LIVE" } });
      }
    } else if (version.status === "ANALYZING") {
      // Nouvelle version au scan propre d'une ressource en ligne
      if (flagged) await tx.resourceVersion.update({ where: { id: version.id }, data: { status: "PENDING" } });
      else await promoteVersion(tx, version.id, true);
    } else if (current.version === version.version && (current.status === "APPROVED" || current.status === "UNLISTED")) {
      // Réanalyse de la version en ligne : seul le badge change (un signalement va dans la modération)
      await tx.resource.update({ where: { id: resource.id }, data: { aiVerified: flagged === false } });
    }
  });

  const after = await db.resource.findUnique({ where: { id: resource.id }, select: { status: true, sellerId: true } });
  if (after?.status === "APPROVED") await grantFounderIfEligible(after.sellerId);

  revalidatePath(`/resources/${resource.slug}`);
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin");
  revalidatePath("/");
}

// Analyse plusieurs versions l'une après l'autre (bouton « Analyser maintenant » de la modération)
export async function analyzeVersions(versionIds: string[], language: "fr" | "en") {
  for (const id of versionIds) {
    await analyzeVersion(id, language).catch((err) => console.error("Analyse IA :", err));
  }
}

// Ressources jamais analysées (publiées avant l'analyse IA) ou dont l'analyse a échoué
// (et analyses bloquées : interrompues depuis plus de 10 minutes, par exemple si le serveur s'est arrêté)
export const AI_STUCK_MS = 10 * 60 * 1000;

export async function findUnanalyzedVersionIds() {
  const stuck = new Date(Date.now() - AI_STUCK_MS);
  const resources = await db.resource.findMany({
    where: { status: { in: ["ANALYZING", "APPROVED", "UNLISTED", "PENDING"] } },
    select: {
      version: true,
      versions: {
        where: { OR: [{ aiStatus: null }, { aiStatus: "FAILED" }, { aiStatus: "PENDING", aiAt: { lt: stuck } }] },
        select: { id: true, version: true },
      },
    },
  });
  return resources.flatMap((r) => r.versions.filter((v) => v.version === r.version).map((v) => v.id));
}

export function parseAiReport(raw: string | null): AiReport | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AiReport;
  } catch {
    return null;
  }
}
