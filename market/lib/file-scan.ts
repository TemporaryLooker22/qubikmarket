import { unzipSync } from "fflate";
import type { Finding, ScanReport } from "./scan";
import { extOf, kindOf } from "./formats";

// Scan de n'importe quel fichier accepté (dans le navigateur pour l'aperçu, et sur le serveur à la publication) :
// - fichier Roblox ou script : le scanner anti-backdoor habituel (lib/scanner)
// - image, son, modèle 3D… : on vérifie que le contenu correspond bien à l'extension (pas de programme déguisé)
// - archive .zip : chaque fichier à l'intérieur est vérifié de la même façon ; un programme (.exe…) fait refuser l'archive
// Le scanner est passé en paramètre : il n'est pas chargé de la même façon dans le navigateur et sur le serveur.

export type RobloxScanner = {
  scanFile(bytes: Uint8Array, fileName: string): ScanReport;
  computeVerdict(findings: Finding[]): { score: number; verdict: ScanReport["verdict"] };
};

const MAX_ARCHIVE_FILES = 3000;
const MAX_ARCHIVE_UNPACKED = 400 * 1024 * 1024; // 400 Mo une fois décompressée (protège des « bombes zip »)
const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

export function scanAnyFile(bytes: Uint8Array, fileName: string, scanner: RobloxScanner): ScanReport {
  const kind = kindOf(fileName);
  if (kind === "roblox" || kind === "script") return scanner.scanFile(bytes, fileName);

  const findings: Finding[] = [];
  let scriptCount = 0;
  let instanceCount = 0;
  let fileCount = 1;

  if (kind === "archive") {
    const entries = unpack(bytes);
    fileCount = entries.length;
    for (const [name, data] of entries) {
      const inner = kindOf(name, true);
      if (inner === "roblox" || inner === "script") {
        const report = scanner.scanFile(data, name);
        findings.push(...report.findings.map((f) => ({ ...f, script: `${name} › ${f.script}` })));
        scriptCount += report.scriptCount;
        instanceCount += report.instanceCount;
      } else if (inner === "dangerous") {
        findings.push(finding("archive-program", "critical", "Programme dans l'archive", `L'archive contient un programme (${extOf(name)}). Une ressource Roblox n'en a jamais besoin : c'est souvent un virus.`, name));
      } else if (inner === "archive") {
        findings.push(finding("archive-nested", "high", "Archive dans l'archive", "Une archive dans une archive ne peut pas être vérifiée. Un modérateur va regarder son contenu.", name));
      } else if (inner === null) {
        findings.push(finding("archive-unknown", "high", "Type de fichier inattendu", `Le fichier « ${name} » n'est pas d'un type accepté sur Qubik. Un modérateur va vérifier à quoi il sert.`, name));
      } else {
        const bad = checkContent(data, name);
        if (bad) findings.push(bad);
      }
    }
  } else {
    const bad = checkContent(bytes, fileName);
    if (bad) findings.push(bad);
  }

  findings.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  return {
    fileName,
    format: kind === "archive" ? "archive" : "media",
    instanceCount,
    scriptCount,
    fileCount,
    findings,
    ...scanner.computeVerdict(findings),
  };
}

// Contenu d'une archive .zip (les dossiers sont ignorés), avec des limites de taille
export function unpack(bytes: Uint8Array): [string, Uint8Array][] {
  let files = 0;
  let total = 0;
  const entries = unzipSync(bytes, {
    filter: (f) => {
      if (f.name.endsWith("/")) return false;
      files++;
      total += f.originalSize;
      if (files > MAX_ARCHIVE_FILES || total > MAX_ARCHIVE_UNPACKED) throw new Error("archive trop grosse une fois décompressée");
      return true;
    },
  });
  return Object.entries(entries);
}

function finding(ruleId: string, severity: Finding["severity"], title: string, explain: string, script: string): Finding {
  return { ruleId, severity, title, explain, script, line: null, snippet: "" };
}

const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
const startsWith = (bytes: Uint8Array, ...values: number[]) => values.every((v, i) => bytes[i] === v);

// Signature (premiers octets) attendue pour chaque format binaire ; les formats texte ne sont pas vérifiés
const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  ".png": (b) => startsWith(b, 0x89, 0x50, 0x4e, 0x47),
  ".jpg": (b) => startsWith(b, 0xff, 0xd8, 0xff),
  ".jpeg": (b) => startsWith(b, 0xff, 0xd8, 0xff),
  ".gif": (b) => ascii(b, 0, 4) === "GIF8",
  ".webp": (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP",
  ".bmp": (b) => ascii(b, 0, 2) === "BM",
  ".psd": (b) => ascii(b, 0, 4) === "8BPS",
  ".dds": (b) => ascii(b, 0, 4) === "DDS ",
  ".mp3": (b) => ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0),
  ".ogg": (b) => ascii(b, 0, 4) === "OggS",
  ".wav": (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE",
  ".flac": (b) => ascii(b, 0, 4) === "fLaC",
  ".m4a": (b) => ascii(b, 4, 4) === "ftyp",
  ".aif": (b) => ascii(b, 0, 4) === "FORM",
  ".aiff": (b) => ascii(b, 0, 4) === "FORM",
  ".mp4": (b) => ascii(b, 4, 4) === "ftyp",
  ".mov": (b) => ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(ascii(b, 4, 4)),
  ".webm": (b) => startsWith(b, 0x1a, 0x45, 0xdf, 0xa3),
  ".ttf": (b) => startsWith(b, 0x00, 0x01, 0x00, 0x00) || ascii(b, 0, 4) === "true",
  ".otf": (b) => ascii(b, 0, 4) === "OTTO",
  ".glb": (b) => ascii(b, 0, 4) === "glTF",
  ".blend": (b) => ascii(b, 0, 7) === "BLENDER",
  ".fbx": (b) => ascii(b, 0, 18) === "Kaydara FBX Binary" || ascii(b, 0, 1) === ";",
  ".pdf": (b) => ascii(b, 0, 4) === "%PDF",
};

// Un programme déguisé (ex. un .exe renommé en .png) est refusé ; un contenu qui ne correspond pas à l'extension
// part chez un modérateur
function checkContent(bytes: Uint8Array, name: string): Finding | null {
  if (ascii(bytes, 0, 2) === "MZ" || startsWith(bytes, 0x7f, 0x45, 0x4c, 0x46) || ascii(bytes, 0, 4) === "\xcf\xfa\xed\xfe") {
    return finding("disguised-program", "critical", "Programme déguisé", `« ${name} » est en réalité un programme, renommé pour ressembler à un autre type de fichier.`, name);
  }
  const check = SIGNATURES[extOf(name)];
  if (check && bytes.length >= 4 && !check(bytes)) {
    return finding("wrong-format", "high", "Contenu différent de l'extension", `Le contenu de « ${name} » ne correspond pas à un fichier ${extOf(name)}. Un modérateur va vérifier.`, name);
  }
  return null;
}
