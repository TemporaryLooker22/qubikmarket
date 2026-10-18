import { NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";
import { getDictionary } from "@/lib/i18n/server";

// Téléchargement sécurisé : seulement pour le vendeur, les modérateurs et les acheteurs
const INLINE_MAX = 4 * 1024 * 1024;

// ?version=<id> : le fichier d'une autre version (vendeur et modérateurs, ex. une version en attente de vérification)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, { t }] = await Promise.all([getCurrentUser(), getDictionary()]);
  if (!user) return NextResponse.json({ error: t.errors.loginRequired }, { status: 401 });

  const resource = await db.resource.findUnique({ where: { id } });
  if (!resource) return NextResponse.json({ error: t.errors.notFound }, { status: 404 });

  const isOwner = resource.sellerId === user.id;
  const isAdmin = user.role === "ADMIN";
  const purchase = await db.purchase.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId: id } } });

  // Une ressource retirée de la vente reste téléchargeable par ceux qui l'ont achetée
  const available = resource.status === "APPROVED" || resource.status === "UNLISTED";
  if (!isOwner && !isAdmin && (purchase?.status !== "PAID" || !available)) {
    return NextResponse.json({ error: t.errors.notBought }, { status: 403 });
  }

  // On note le téléchargement de l'acheteur (le badge « Nouvelle version » de Mes achats disparaît)
  if (purchase?.status === "PAID") {
    await db.purchase.update({ where: { id: purchase.id }, data: { lastDownloadedAt: new Date() } });
  }

  let stored = { filePath: resource.filePath, fileName: resource.fileName, fileSize: resource.fileSize };
  const versionId = new URL(req.url).searchParams.get("version");
  if (versionId && (isOwner || isAdmin)) {
    const version = await db.resourceVersion.findFirst({ where: { id: versionId, resourceId: resource.id }, select: { filePath: true, fileName: true, fileSize: true } });
    if (!version) return NextResponse.json({ error: t.errors.notFound }, { status: 404 });
    stored = version;
  }

  // Gros fichier (plus de 4 Mo) : Vercel ne peut pas le faire passer par le serveur, on redirige vers le stockage
  // (adresse longue et impossible à deviner, valable pour ce fichier seulement)
  if (stored.filePath.startsWith("https://") && stored.fileSize > INLINE_MAX) {
    return NextResponse.redirect(getDownloadUrl(stored.filePath), { headers: { "Cache-Control": "private, no-store" } });
  }

  const file = await readUpload(stored.filePath);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(stored.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
