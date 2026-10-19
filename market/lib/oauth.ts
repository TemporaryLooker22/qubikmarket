import "server-only";
import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { SITE_URL } from "./site";

// Connexion avec Google ou Discord (OAuth 2). Les clés viennent des variables d'environnement :
// GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET et DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET.
// Sans clés, le bouton du fournisseur n'est pas affiché.
// Adresse de retour à déclarer chez chacun : <APP_URL>/api/auth/google/callback (ou /discord/callback).

export const PROVIDERS = ["google", "discord"] as const;
export type Provider = (typeof PROVIDERS)[number];
export const isProvider = (v: unknown): v is Provider => PROVIDERS.includes(v as Provider);

const CONFIG = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    profile: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
    id: () => process.env.GOOGLE_CLIENT_ID,
    secret: () => process.env.GOOGLE_CLIENT_SECRET,
  },
  discord: {
    authorize: "https://discord.com/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    profile: "https://discord.com/api/users/@me",
    scope: "identify email",
    id: () => process.env.DISCORD_CLIENT_ID,
    secret: () => process.env.DISCORD_CLIENT_SECRET,
  },
} satisfies Record<Provider, unknown>;

export const isConfigured = (p: Provider) => Boolean(CONFIG[p].id() && CONFIG[p].secret());
export const configuredProviders = () => PROVIDERS.filter(isConfigured);

const redirectUri = (p: Provider) => `${SITE_URL}/api/auth/${p}/callback`;

// ---------- Petits cookies signés (le temps de l'aller-retour chez Google ou Discord) ----------

export const STATE_COOKIE = "qubik_oauth";
export const PENDING_COOKIE = "qubik_oauth_signup";

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET manquant ou trop court");
  return new TextEncoder().encode(secret);
}
export async function sign(payload: Record<string, unknown>, minutes: number) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${minutes}m`).sign(key());
}
export async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    return (await jwtVerify(token, key())).payload as T;
  } catch {
    return null;
  }
}

// ---------- Aller : page de connexion du fournisseur ----------

export function newState() {
  return randomBytes(24).toString("base64url");
}

export function authorizeUrl(p: Provider, state: string) {
  const c = CONFIG[p];
  const url = new URL(c.authorize);
  url.searchParams.set("client_id", c.id()!);
  url.searchParams.set("redirect_uri", redirectUri(p));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", c.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", p === "google" ? "select_account" : "consent");
  return url.toString();
}

// ---------- Retour : le profil vérifié ----------

export type OAuthProfile = { provider: Provider; id: string; email: string; name: string; avatar: string | null };

export async function fetchProfile(p: Provider, code: string): Promise<OAuthProfile | null> {
  const c = CONFIG[p];
  const tokenRes = await fetch(c.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: c.id()!, client_secret: c.secret()!, code, grant_type: "authorization_code", redirect_uri: redirectUri(p) }),
    cache: "no-store",
  });
  if (!tokenRes.ok) return null;
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) return null;
  const res = await fetch(c.profile, { headers: { Authorization: `Bearer ${access_token}` }, cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  // On n'accepte qu'une adresse e-mail vérifiée par le fournisseur (elle sert à relier un compte existant)
  if (p === "google") {
    if (!data.sub || !data.email || data.email_verified !== true) return null;
    return { provider: p, id: str(data.sub), email: str(data.email).toLowerCase(), name: str(data.given_name) || str(data.name), avatar: str(data.picture) || null };
  }
  if (!data.id || !data.email || data.verified !== true) return null;
  const avatar = data.avatar ? `https://cdn.discordapp.com/avatars/${str(data.id)}/${str(data.avatar)}.png?size=256` : null;
  return { provider: p, id: str(data.id), email: str(data.email).toLowerCase(), name: str(data.global_name) || str(data.username), avatar };
}

// Pseudo proposé à partir du nom chez le fournisseur (lettres, chiffres et _ ; 3 à 20 caractères)
export function suggestUsername(name: string, email: string) {
  const clean = (v: string) =>
    v
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_]+/g, "")
      .slice(0, 20);
  const base = clean(name) || clean(email.split("@")[0]);
  return base.length >= 3 ? base : `${base}player`.slice(0, 20);
}
