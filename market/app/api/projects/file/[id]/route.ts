import { NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";
import { projectRole } from "@/lib/projects";

const INLINE_MAX = 4 * 1024 * 1024;

// Fichier livré dans un projet sur mesure : seulement pour le client, le développeur et la modération
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const message = await db.projectMessage.findUnique({ where: { id }, include: { project: { select: { clientId: true, devId: true } } } });
  if (!message?.filePath || !message.fileName) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!projectRole(message.project, user)) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  // Gros fichier : Vercel ne peut pas le faire passer par le serveur, on redirige vers le stockage (adresse impossible à deviner)
  if (message.filePath.startsWith("https://") && (message.fileSize ?? 0) > INLINE_MAX) {
    return NextResponse.redirect(getDownloadUrl(message.filePath), { headers: { "Cache-Control": "private, no-store" } });
  }
  const file = await readUpload(message.filePath);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(message.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
