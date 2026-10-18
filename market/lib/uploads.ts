import "server-only";
import { head } from "@vercel/blob";
import { ALLOWED_EXTENSIONS, extOf, MAX_FILE_SIZE, MAX_FILE_SIZE_INLINE } from "./formats";
import { directUploads, readUpload, saveUpload } from "./storage";
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
