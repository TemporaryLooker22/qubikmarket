import "server-only";
import { scanAnyFile } from "./file-scan";

// Le scanner anti-backdoor (le même code que Qubik Scanner)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scanner = require("./scanner/scanner.js");

export type Severity = "critical" | "high" | "medium" | "low";
export type Verdict = "clean" | "suspicious" | "dangerous";

export type Finding = {
  ruleId: string;
  severity: Severity;
  title: string;
  explain: string;
  script: string;
  line: number | null;
  snippet: string;
};

export type ScanReport = {
  fileName: string;
  format: "binary" | "xml" | "text" | "media" | "archive"; // media : image, son, 3D… ; archive : .zip
  fileCount?: number; // fichiers vérifiés (archives et médias)
  instanceCount: number;
  scriptCount: number;
  findings: Finding[];
  score: number;
  verdict: Verdict;
};

export function scanFile(bytes: Uint8Array, fileName: string): ScanReport {
  return scanner.scanFile(bytes, fileName);
}

// N'importe quel format accepté (fichier Roblox, image, son, 3D, archive .zip…) : voir lib/file-scan.ts
export function scanUpload(bytes: Uint8Array, fileName: string): ScanReport {
  return scanAnyFile(bytes, fileName, scanner);
}

// Le fichier contient-il du contenu Roblox que l'IA peut analyser (objets ou scripts) ?
export const hasRobloxContent = (report: ScanReport) => report.instanceCount > 0 || report.scriptCount > 0;

// Contenu d'un fichier Roblox : tous les objets (classe, nom, chemin) et le code des scripts
// (utilisé par l'analyse IA, voir lib/ai/digest.ts)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const reader = require("./scanner/rbxm.js") as {
  readRobloxFile(
    bytes: Uint8Array,
    fileName: string,
  ): {
    format: ScanReport["format"];
    instances: { className: string; name: string; path: string; source?: string }[];
    scripts: { className: string; name: string; path: string; source: string }[];
  };
};

export function readRobloxFile(bytes: Uint8Array, fileName: string) {
  return reader.readRobloxFile(bytes, fileName);
}
