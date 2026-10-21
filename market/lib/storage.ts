import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import sharp from "sharp";

// Deux modes de stockage des fichiers des vendeurs :
// - sur Vercel (BLOB_READ_WRITE_TOKEN défini) : Vercel Blob, avec une adresse impossible à deviner
// - en local : le dossier storage/uploads
// L'adresse n'est pas affichée sur le site : on passe par /api/download (qui redirige vers le fichier au-delà de 4 Mo).
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
// Les fichiers vendus (jusqu'à 50 Mo) partent directement du navigateur vers Vercel Blob (voir lib/uploads.ts)
export const directUploads = useBlob;
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

// Images compressées : préfixe de leur nom dans le stockage (images/q-…), pour reconnaître celles déjà traitées
export const COMPRESSED_PREFIX = "q-";
// Plus grand côté gardé : assez pour la galerie d'une ressource en plein écran
export const IMAGE_MAX_SIDE = 1920;
// Photos de profil : affichées en petit
export const AVATAR_MAX_SIDE = 512;

// Réduit une image (1920 px au plus) et la convertit en WebP : ~10 fois plus légère qu'une capture d'écran brute,
// sans différence visible sur le site. On garde l'originale si elle est déjà plus légère (ou illisible).
export async function compressImage(bytes: Uint8Array, ext: ImageExt, maxSide = IMAGE_MAX_SIDE): Promise<{ bytes: Uint8Array; ext: ImageExt }> {
  try {
    const out = await sharp(bytes, { limitInputPixels: 100_000_000 })
      .rotate()
      .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return out.length < bytes.length ? { bytes: new Uint8Array(out), ext: "webp" } : { bytes, ext };
  } catch {
    return { bytes, ext };
  }
}

// Captures d'écran : publiques (affichées sur le site), contrairement aux fichiers vendus. Compressées avant d'être gardées.
// Sur Vercel : Vercel Blob. En local sans Blob : dossier public/uploads (servi par Next.js).
export async function saveImage(original: Uint8Array, originalExt: ImageExt, maxSide = IMAGE_MAX_SIDE) {
  const { bytes, ext } = await compressImage(original, originalExt, maxSide);
  const name = `${COMPRESSED_PREFIX}${randomUUID()}.${ext}`;
  if (useBlob) {
    const blob = await put(`images/${name}`, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: true,
      contentType: IMAGE_TYPES[ext],
    });
    return blob.url;
  }
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${name}`;
}

const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;
export type ImageExt = keyof typeof IMAGE_TYPES;

// Reconnaît une vraie image à ses premiers octets (on ne fait pas confiance au nom du fichier)
export function detectImage(bytes: Uint8Array): ImageExt | null {
  const b = bytes;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
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

// Efface des fichiers (fichiers vendus et captures d'écran) : dans Vercel Blob ou dans les dossiers locaux
export async function deleteStored(paths: string[]) {
  const blobs = paths.filter((p) => p.startsWith("https://"));
  if (blobs.length) await del(blobs);
  for (const p of paths.filter((p) => !p.startsWith("https://"))) {
    const dir = p.startsWith("/uploads/") ? path.join(process.cwd(), "public", "uploads") : STORAGE_DIR;
    await rm(path.join(dir, path.basename(p)), { force: true });
  }
}
