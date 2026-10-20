import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const COOKIE_NAME = "qubik_session";
const SESSION_DAYS = 30;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET manquant ou trop court dans le fichier .env");
  return new TextEncoder().encode(secret);
}

// Crée la session après une connexion réussie (cookie signé, illisible par le navigateur)
export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}

// Renvoie l'utilisateur connecté, ou null
export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    // Un compte banni n'est plus connecté (voir lib/moderation.ts)
    return await db.user.findUnique({
      where: { id: payload.sub, bannedAt: null },
      select: { id: true, username: true, email: true, role: true, avatarUrl: true },
    });
  } catch {
    return null;
  }
}

// À utiliser dans les pages réservées aux membres connectés.
// `next` : la page où revenir après la connexion (ex. "/sell")
export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

// Propriétaire du site : le premier compte modérateur créé. Lui seul peut nommer ou retirer des modérateurs,
// pour qu'un modérateur ne puisse jamais retirer l'accès du propriétaire.
export async function siteOwnerId() {
  const owner = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  return owner?.id ?? null;
}

export async function requireAdmin() {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
