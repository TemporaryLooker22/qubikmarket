import "server-only";
import { readRobloxFile } from "@/lib/scan";
import { unpack } from "@/lib/file-scan";
import { extOf, kindOf } from "@/lib/formats";

// Résumé d'un fichier Roblox pour l'analyse IA : le nombre d'objets par type, l'arborescence (les pièces
// répétées sont regroupées) et le code des scripts, le tout limité en taille.

const MAX_TREE_LINES = 160;
const MAX_SCRIPTS = 25;
const MAX_SCRIPT_CHARS = 3500;
const MAX_TOTAL_SCRIPT_CHARS = 45000;
const PART_CLASSES = new Set(["Part", "MeshPart", "UnionOperation", "WedgePart", "CornerWedgePart", "TrussPart", "SpawnLocation", "Seat"]);

// Archive .zip (pack de plusieurs fichiers) : la liste des fichiers, puis le résumé des fichiers Roblox et scripts
const MAX_ARCHIVE_LINES = 200;
const MAX_ARCHIVE_ROBLOX = 6;

export function buildDigest(bytes: Uint8Array, fileName: string) {
  if (extOf(fileName) !== ".zip") return robloxDigest(bytes, fileName);
  const entries = unpack(bytes);
  const lines = [`Archive: ${fileName} (${bytes.length} bytes, ${entries.length} files)`, "", "Files (path - size in bytes):"];
  for (const [name, data] of entries.slice(0, MAX_ARCHIVE_LINES)) lines.push(`- ${name} - ${data.length}`);
  if (entries.length > MAX_ARCHIVE_LINES) lines.push(`... ${entries.length - MAX_ARCHIVE_LINES} more files`);
  const roblox = entries.filter(([name]) => ["roblox", "script"].includes(kindOf(name, true) ?? ""));
  for (const [name, data] of roblox.slice(0, MAX_ARCHIVE_ROBLOX)) lines.push("", `=== ${name} ===`, robloxDigest(data, name));
  return lines.join("\n");
}

function robloxDigest(bytes: Uint8Array, fileName: string) {
  const file = readRobloxFile(bytes, fileName);
  const lines: string[] = [];
  lines.push(`File: ${fileName} (${file.format}, ${bytes.length} bytes)`);
  lines.push(`Objects: ${file.instances.length}, scripts: ${file.scripts.length}`);

  // Nombre d'objets par type
  const counts = new Map<string, number>();
  for (const i of file.instances) counts.set(i.className, (counts.get(i.className) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
  lines.push(`Object types: ${top.map(([c, n]) => `${c} x${n}`).join(", ")}`);

  // Objets qui gardent leur nom par défaut (« Part », « Model »…) : souvent signe d'un travail bâclé
  const defaultNames = file.instances.filter((i) => i.name === i.className).length;
  lines.push(`Objects still named after their class (default names): ${defaultNames}`);

  // Arborescence, sans les centaines de pièces identiques d'une map
  lines.push("", "Tree (path - class):");
  const partsByParent = new Map<string, number>();
  let shown = 0;
  for (const i of file.instances) {
    if (PART_CLASSES.has(i.className)) {
      const parent = i.path.split(".").slice(0, -1).join(".") || "(root)";
      partsByParent.set(parent, (partsByParent.get(parent) ?? 0) + 1);
      continue;
    }
    if (shown++ < MAX_TREE_LINES) lines.push(`- ${i.path} - ${i.className}`);
  }
  if (shown > MAX_TREE_LINES) lines.push(`... ${shown - MAX_TREE_LINES} more objects`);
  for (const [parent, n] of [...partsByParent.entries()].slice(0, 30)) lines.push(`- ${parent}: ${n} parts`);

  // Code des scripts (les plus longs d'abord, tronqués)
  lines.push("", "Scripts:");
  let budget = MAX_TOTAL_SCRIPT_CHARS;
  const scripts = [...file.scripts].sort((a, b) => b.source.length - a.source.length);
  for (const s of scripts.slice(0, MAX_SCRIPTS)) {
    const code = s.source.trim();
    const lineCount = code ? code.split("\n").length : 0;
    const excerpt = code.slice(0, Math.min(MAX_SCRIPT_CHARS, Math.max(0, budget)));
    budget -= excerpt.length;
    lines.push(`--- ${s.path} (${s.className}, ${lineCount} lines${excerpt.length < code.length ? ", truncated" : ""})`);
    lines.push(code ? excerpt : "(empty script)");
  }
  if (scripts.length > MAX_SCRIPTS) lines.push(`... ${scripts.length - MAX_SCRIPTS} more scripts not shown`);

  return lines.join("\n");
}
