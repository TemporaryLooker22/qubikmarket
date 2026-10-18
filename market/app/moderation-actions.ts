"use server";

// Actions de la page Modération → Utilisateurs (admins) : bannir et débannir un membre.
// Elles s'exécutent sur le serveur.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { banUser, logModeration, unbanUser } from "@/lib/moderation";

function refreshSite() {
  revalidatePath("/", "layout");
}

export async function banMember(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, username: true, role: true, bannedAt: true } });
  // On ne bannit ni un modérateur ni soi-même
  if (!user || user.bannedAt || user.role === "ADMIN" || user.id === admin.id) return;
  await banUser(user.id, reason);
  await logModeration({ moderatorId: admin.id, action: "BAN", targetType: "user", targetId: user.id, label: user.username, note: reason });
  refreshSite();
}

export async function unbanMember(formData: FormData) {
  const admin = await requireAdmin();
  const user = await db.user.findUnique({ where: { id: String(formData.get("userId")) }, select: { id: true, username: true, bannedAt: true } });
  if (!user?.bannedAt) return;
  await unbanUser(user.id);
  await logModeration({ moderatorId: admin.id, action: "UNBAN", targetType: "user", targetId: user.id, label: user.username });
  refreshSite();
}
