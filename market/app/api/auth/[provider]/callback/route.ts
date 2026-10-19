import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { fetchProfile, isProvider, PENDING_COOKIE, sign, STATE_COOKIE, verify, type Provider } from "@/lib/oauth";

type State = { state: string; provider: Provider; next: string; src: string };

// Page où revenir : seulement une adresse du site
const safeNext = (next: string) => (next.startsWith("/") && !next.startsWith("//") && !/^\/(login|register)\b/.test(next) ? next : "/");

// Retour de Google ou Discord : on connecte le membre (compte déjà relié, ou même e-mail vérifié),
// sinon on l'envoie choisir son pseudo (/register/complete) avant de créer son compte.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const url = new URL(req.url);
  const go = (path: string) => NextResponse.redirect(new URL(path, req.url));
  const jar = await cookies();
  const saved = await verify<State>(jar.get(STATE_COOKIE)?.value);
  jar.delete(STATE_COOKIE);

  if (!isProvider(provider) || !saved || saved.provider !== provider || saved.state !== url.searchParams.get("state")) return go("/login?error=oauth_failed");
  if (url.searchParams.get("error")) return go("/login?error=oauth_cancelled");
  const code = url.searchParams.get("code");
  const profile = code ? await fetchProfile(provider, code).catch(() => null) : null;
  if (!profile) return go("/login?error=oauth_failed");

  const column = provider === "google" ? "googleId" : "discordId";
  // Compte déjà relié à ce Google / Discord, sinon compte avec la même adresse e-mail (vérifiée par le fournisseur)
  const linked = await db.user.findFirst({ where: { [column]: profile.id } });
  const user = linked ?? (await db.user.findUnique({ where: { email: profile.email } }));
  if (user) {
    if (user.bannedAt) return go("/login?error=banned");
    if (!linked) {
      await db.user.update({ where: { id: user.id }, data: { [column]: profile.id, ...(!user.avatarUrl && profile.avatar && { avatarUrl: profile.avatar }) } });
    }
    await createSession(user.id);
    return go(safeNext(saved.next));
  }

  // Nouveau membre : il choisit son pseudo et accepte les conditions avant la création du compte
  jar.set(PENDING_COOKIE, await sign({ ...profile, src: saved.src, next: saved.next }, 30), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 1800,
  });
  return go("/register/complete");
}
