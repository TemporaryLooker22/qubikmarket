"use client";

import { useRef, useState } from "react";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_INLINE } from "@/lib/formats";
import { uploadResourceFile } from "@/lib/upload-client";

// Envoi du fichier vendu au moment de publier (mise en vente et nouvelle version).
// directUpload (Vercel Blob disponible) : le fichier part directement dans le stockage (50 Mo max), avec sa progression,
// et le formulaire ne contient que son adresse. Sinon (en local) : le fichier part avec le formulaire (4 Mo max).
export function useFileUpload(directUpload: boolean) {
  const [progress, setProgress] = useState<number | null>(null);
  // Si le serveur refuse le formulaire (titre trop court…), on ne renvoie pas le même fichier une deuxième fois
  const sent = useRef<{ file: File; url: string } | null>(null);
  const maxSize = directUpload ? MAX_FILE_SIZE : MAX_FILE_SIZE_INLINE;

  // Ajoute le fichier au formulaire ; false si l'envoi a échoué
  const attach = async (file: File, formData: FormData) => {
    if (!directUpload) {
      formData.set("file", file);
      return true;
    }
    try {
      let url = sent.current?.file === file ? sent.current.url : null;
      if (!url) {
        setProgress(0);
        url = await uploadResourceFile(file, setProgress);
        sent.current = { file, url };
      }
      formData.set("fileUrl", url);
      formData.set("fileName", file.name);
      return true;
    } catch {
      return false;
    } finally {
      setProgress(null);
    }
  };

  return { progress, attach, maxSize, maxMb: Math.round(maxSize / 1024 / 1024) };
}
