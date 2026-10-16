import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

// Téléchargement sécurisé : seulement pour le vendeur, les modérateurs et les acheteurs
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });

  const resource = await db.resource.findUnique({ where: { id } });
  if (!resource) return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });

  const isOwner = resource.sellerId === user.id;
  const isAdmin = user.role === "ADMIN";
  const purchase = await db.purchase.findUnique({ where: { userId_resourceId: { userId: user.id, resourceId: id } } });

  if (!isOwner && !isAdmin && (purchase?.status !== "PAID" || resource.status !== "APPROVED")) {
    return NextResponse.json({ error: "Tu n'as pas acheté cette ressource" }, { status: 403 });
  }

  const file = await readUpload(resource.filePath);
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(resource.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
