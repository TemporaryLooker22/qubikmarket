import "server-only";
import { head } from "@vercel/blob";
import { ALLOWED_EXTENSIONS, extOf, IMAGE_EXTENSIONS, MAX_FILE_SIZE, MAX_FILE_SIZE_INLINE, MAX_IMAGE_SIZE_DIRECT } from "./formats";
import { COMPRESSED_PREFIX, deleteStored, detectImage, directUploads, IMAGE_MAX_SIDE, readUpload, saveImage, saveUpload } from "./storage";
import type { Dictionary } from "./i18n/dictionaries";

// Réception du fichier vendu, quand le vendeur publie une ressource ou une nouvelle version.
// Sur Vercel, le navigateur envoie le fichier directement dans Vercel Blob (jusqu'à 50 Mo, voir app/api/upload)
// et le formulaire ne contient que son adresse (fileUrl) : on vérifie qu'il est bien dans notre stockage, puis on le relit
// pour le scanner. En local sans Vercel Blob, le fichier arrive avec le formulaire (4 Mo au plus).

export type ReceivedFile = { bytes: Uint8Array; fileName: string; fileSize: number; filePath: string };

// Nom affiché et proposé au téléchargement : sans dossier ni caractères de contrôle
const cleanName = (name: string) =>
  name
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(-120);

export async function receiveUpload(formData: FormData, t: Dictionary): Promise<ReceivedFile | { error: string }> {
  const formats = t.errors.fileFormat(ALLOWED_EXTENSIONS.join(", "));
  const url = formData.get("fileUrl");

  if (typeof url === "string" && url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { error: t.errors.fileMissing };
    }
    // Seulement un fichier envoyé dans le dossier uploads/ de notre stockage Vercel Blob
    if (!directUploads || parsed.protocol !== "https:" || !parsed.hostname.endsWith(".public.blob.vercel-storage.com") || !parsed.pathname.startsWith("/uploads/")) {
      return { error: t.errors.fileMissing };
    }
    const info = await head(url).catch(() => null);
    if (!info) return { error: t.errors.fileMissing };
    if (info.size > MAX_FILE_SIZE) return { error: t.errors.fileTooBig };
    const fileName = cleanName(String(formData.get("fileName") ?? "")) || cleanName(decodeURIComponent(parsed.pathname));
    if (!ALLOWED_EXTENSIONS.includes(extOf(fileName)) || extOf(fileName) !== extOf(parsed.pathname)) return { error: formats };
    const bytes = new Uint8Array(await readUpload(url));
    return { bytes, fileName, fileSize: bytes.length, filePath: url };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t.errors.fileMissing };
  if (file.size > MAX_FILE_SIZE_INLINE) return { error: t.errors.fileTooBig };
  const fileName = cleanName(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extOf(fileName))) return { error: formats };
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { bytes, fileName, fileSize: file.size, filePath: await saveUpload(bytes, fileName) };
}

// Capture d'écran envoyée directement dans Vercel Blob : elle doit être dans le dossier images/ de notre stockage,
// peser 20 Mo au plus, et être une vraie image (on lit ses premiers octets)
export async function isUploadedImage(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!directUploads || parsed.protocol !== "https:" || !parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
  if (!parsed.pathname.startsWith("/images/") || !IMAGE_EXTENSIONS.includes(extOf(parsed.pathname))) return false;
  const info = await head(url).catch(() => null);
  if (!info || info.size > MAX_IMAGE_SIZE_DIRECT) return false;
  const start = await fetch(url, { headers: { Range: "bytes=0-31" }, cache: "no-store" }).then((r) => r.arrayBuffer()).catch(() => null);
  return start !== null && detectImage(new Uint8Array(start)) !== null;
}

// Image déjà compressée (nom en images/q-…) : rien à refaire
export function isCompressedImage(url: string) {
  try {
    return new URL(url, "https://qubikmarket.com").pathname.split("/").pop()!.startsWith(COMPRESSED_PREFIX);
  } catch {
    return false;
  }
}

// Image envoyée directement dans le stockage (déjà vérifiée par isUploadedImage) : on la remplace par sa version
// compressée et on efface l'originale. En cas de problème, on garde l'originale telle quelle.
export async function compressUploadedImage(url: string, maxSide = IMAGE_MAX_SIDE) {
  if (isCompressedImage(url)) return url;
  try {
    const bytes = new Uint8Array(await readUpload(url));
    const ext = detectImage(bytes);
    if (!ext) return url;
    const compressed = await saveImage(bytes, ext, maxSide);
    await deleteStored([url]).catch(() => {});
    return compressed;
  } catch (err) {
    console.error("Compression d'image :", err);
    return url;
  }
}
