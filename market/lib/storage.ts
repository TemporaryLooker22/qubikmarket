import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";

// Deux modes de stockage des fichiers des vendeurs :
// - sur Vercel (BLOB_READ_WRITE_TOKEN défini) : Vercel Blob, avec une adresse impossible à deviner
// - en local : le dossier storage/uploads
// Dans les deux cas, l'adresse n'est jamais montrée aux visiteurs : on passe par /api/download.
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const STORAGE_DIR = path.join(process.cwd(), "storage", "uploads");

export async function saveUpload(bytes: Uint8Array, originalName: string) {
  const storedName = `${randomUUID()}${path.extname(originalName).toLowerCase()}`;

  if (useBlob) {
    const blob = await put(`uploads/${storedName}`, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/octet-stream",
    });
    return blob.url;
  }

  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(path.join(STORAGE_DIR, storedName), bytes);
  return storedName;
}

export async function readUpload(stored: string) {
  if (stored.startsWith("https://")) {
    const res = await fetch(stored, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fichier introuvable (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  // path.basename empêche de sortir du dossier (ex. "../../.env")
  return readFile(path.join(STORAGE_DIR, path.basename(stored)));
}
