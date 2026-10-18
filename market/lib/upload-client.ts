import { upload } from "@vercel/blob/client";

// Envoi du fichier vendu, directement du navigateur vers Vercel Blob (jusqu'à 50 Mo), avec la progression.
// app/api/upload autorise l'envoi ; le serveur scanne le fichier ensuite, à la publication (lib/uploads.ts).
// Le nom d'origine est gardé dans l'adresse (dans un dossier au nom aléatoire) : c'est celui proposé au téléchargement.
export async function uploadResourceFile(file: File, onProgress: (percent: number) => void) {
  const safeName = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-80) || "file";
  const blob = await upload(`uploads/${crypto.randomUUID()}/${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    contentType: "application/octet-stream",
    multipart: file.size > 8 * 1024 * 1024, // gros fichier : envoyé en plusieurs morceaux, réessayés en cas de coupure
    onUploadProgress: ({ percentage }) => onProgress(Math.round(percentage)),
  });
  return blob.url;
}

// Capture d'écran (déjà préparée par ImagePicker), envoyée directement dans Vercel Blob
export async function uploadImage(file: File) {
  const ext = file.type === "image/png" ? ".png" : file.type === "image/jpeg" ? ".jpg" : ".webp";
  const blob = await upload(`images/${crypto.randomUUID()}${ext}`, file, { access: "public", handleUploadUrl: "/api/upload", contentType: file.type || "image/webp" });
  return blob.url;
}
