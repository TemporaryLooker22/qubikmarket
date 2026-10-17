import "server-only";
import type { Prisma } from "@prisma/client";

// Versions d'une ressource (table ResourceVersion). La ressource garde toujours en direct les champs
// fichier et scan de sa version en ligne : c'est ce que télécharge l'acheteur (/api/download).

type Tx = Prisma.TransactionClient;

// Numéro de version : chiffres séparés par des points (1.0, 1.2, 2.0.1), 4 niveaux au plus
export function isValidVersion(version: string) {
  return /^\d{1,4}(\.\d{1,4}){0,3}$/.test(version);
}

// Compare deux numéros de version chiffre par chiffre (1.10 est après 1.9)
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Plus grand numéro déjà utilisé (en ligne, ancien, en vérification ou refusé)
export function latestVersion(versions: string[]) {
  return versions.filter(isValidVersion).sort(compareVersions).pop() ?? "1.0";
}

// Suggestion pour la prochaine version : on augmente le dernier chiffre (1.2 → 1.3, 2.0.1 → 2.0.2)
export function suggestNextVersion(current: string) {
  if (!isValidVersion(current)) return "";
  const parts = current.split(".").map(Number);
  parts[parts.length - 1]++;
  return parts.join(".");
}

// Met une version en ligne : l'ancienne version en ligne devient « ancienne », et la ressource prend
// le fichier et le scan de la nouvelle. `updated` : vrai pour une mise à jour (badge « Nouvelle version »).
export async function promoteVersion(tx: Tx, versionId: string, updated: boolean) {
  const version = await tx.resourceVersion.findUniqueOrThrow({ where: { id: versionId } });
  await tx.resourceVersion.updateMany({
    where: { resourceId: version.resourceId, id: { not: version.id }, status: { in: ["LIVE", "PENDING"] } },
    data: { status: "OLD" },
  });
  await tx.resourceVersion.update({ where: { id: version.id }, data: { status: "LIVE", reviewNote: null } });
  await tx.resource.update({
    where: { id: version.resourceId },
    data: {
      version: version.version,
      fileName: version.fileName,
      filePath: version.filePath,
      fileSize: version.fileSize,
      scanVerdict: version.scanVerdict,
      scanScore: version.scanScore,
      scanReport: version.scanReport,
      // Badge « Contenu vérifié » : celui de la nouvelle version en ligne
      aiVerified: version.aiStatus === "DONE" && version.aiFlagged === false,
      ...(updated && { versionUpdatedAt: new Date() }),
    },
  });
}
