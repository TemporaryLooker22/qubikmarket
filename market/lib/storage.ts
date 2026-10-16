import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Les fichiers des vendeurs sont rangés hors du dossier "public" :
// on ne peut les télécharger qu'après vérification (achat, gratuit ou propriétaire).
const STORAGE_DIR = path.join(process.cwd(), "storage", "uploads");

export async function saveUpload(bytes: Uint8Array, originalName: string) {
  await mkdir(STORAGE_DIR, { recursive: true });
  const ext = path.extname(originalName).toLowerCase();
  const storedName = `${randomUUID()}${ext}`;
  await writeFile(path.join(STORAGE_DIR, storedName), bytes);
  return storedName;
}

export async function readUpload(storedName: string) {
  // path.basename empêche de sortir du dossier (ex. "../../.env")
  return readFile(path.join(STORAGE_DIR, path.basename(storedName)));
}
