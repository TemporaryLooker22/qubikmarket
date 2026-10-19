import "server-only";
import { createHmac, createHash } from "node:crypto";
import { db } from "./db";

// Mesure des visites sans cookie (Modération → Statistiques).
// Le visiteur est une empreinte anonyme : adresse IP + navigateur + un secret qui change chaque jour, hachés.
// On ne peut donc ni retrouver l'adresse IP, ni suivre quelqu'un d'un jour à l'autre.

export const RETENTION_DAYS = 395; // 13 mois
export const TIME_ZONE = "Europe/Brussels";

// Robots connus (ceux qui ne sont pas listés ici mais s'annoncent comme tels sont regroupés dans « Autre robot »)
const BOTS: [RegExp, string][] = [
  [/googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|storebot-google/i, "Googlebot"],
  [/bingbot|bingpreview|msnbot/i, "Bingbot"],
  [/duckduckbot/i, "DuckDuckBot"],
  [/yandex/i, "YandexBot"],
  [/baiduspider/i, "Baiduspider"],
  [/applebot/i, "Applebot"],
  [/discordbot/i, "Discordbot"],
  [/twitterbot/i, "Twitterbot"],
  [/facebookexternalhit|meta-externalagent/i, "Facebook"],
  [/gptbot|chatgpt-user|oai-searchbot/i, "OpenAI"],
  [/claudebot|claude-web|anthropic-ai/i, "ClaudeBot"],
  [/perplexitybot/i, "PerplexityBot"],
  [/ahrefsbot|semrushbot|mj12bot|dotbot|petalbot/i, "SEO (Ahrefs, Semrush…)"],
  [/vercel/i, "Vercel"],
];
const GENERIC_BOT = /bot|crawler|spider|crawl|slurp|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget|python-requests|axios|node-fetch|go-http-client|java\//i;

export function botName(ua: string): string | null {
  if (!ua) return "Autre robot";
  for (const [re, name] of BOTS) if (re.test(ua)) return name;
  return GENERIC_BOT.test(ua) ? "Autre robot" : null;
}

export function parseUserAgent(ua: string) {
  const device = /ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(ua) ? "tablet" : /mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua) ? "mobile" : "desktop";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /samsungbrowser/i.test(ua)
        ? "Samsung Internet"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /chrome|crios|chromium/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
              ? "Safari"
              : "Autre";
  const os = /windows/i.test(ua)
    ? "Windows"
    : /iphone|ipad|ipod/i.test(ua)
      ? "iOS"
      : /android/i.test(ua)
        ? "Android"
        : /mac os|macintosh/i.test(ua)
          ? "macOS"
          : /cros/i.test(ua)
            ? "ChromeOS"
            : /linux/i.test(ua)
              ? "Linux"
              : "Autre";
  return { device, browser, os };
}

// Jour au fuseau de Bruxelles (AAAA-MM-JJ), pour le secret du jour et « aujourd'hui »
export function localDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Minuit (heure de Bruxelles) du jour de `date`, en date UTC
export function startOfLocalDay(date = new Date()) {
  const [y, m, d] = localDay(date).split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  // Décalage de Bruxelles à ce moment-là (1 h ou 2 h selon l'heure d'été)
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(utcMidnight));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(utcMidnight - (local - utcMidnight));
}

// Empreinte anonyme du visiteur pour aujourd'hui
export function visitorId(headers: Headers) {
  const ip = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || headers.get("x-real-ip") || "0.0.0.0";
  const ua = headers.get("user-agent") ?? "";
  const secret = process.env.SESSION_SECRET ?? "qubik";
  const daySalt = createHmac("sha256", secret).update(`visits:${localDay()}`).digest("hex");
  return createHash("sha256").update(`${daySalt}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

// Page enregistrée : sans paramètres (sauf la catégorie du catalogue), espaces privés regroupés
export function normalizePath(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw, "https://qubikmarket.com");
  } catch {
    return null;
  }
  let p = url.pathname.replace(/\/+$/, "") || "/";
  if (p.length > 200 || /\.[a-z0-9]{2,5}$/i.test(p)) return null; // fichiers (images, robots.txt…)
  if (p.startsWith("/admin") || p.startsWith("/api")) return null;
  if (p.startsWith("/dashboard")) p = "/dashboard";
  else if (p.startsWith("/messages")) p = "/messages";
  else if (p.startsWith("/checkout")) p = "/checkout";
  if (p === "/resources") {
    const category = url.searchParams.get("category");
    if (category && /^[a-z-]{2,30}$/.test(category)) p = `/resources?category=${category}`;
  }
  return p;
}

const clip = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export async function recordPageView(headers: Headers, input: { path: string; source?: string; referrer?: string; campaign?: string; locale?: string }) {
  const path = normalizePath(input.path);
  if (!path) return;
  const ua = headers.get("user-agent") ?? "";
  const { device, browser, os } = parseUserAgent(ua);
  await db.pageView.create({
    data: {
      visitor: visitorId(headers),
      path,
      source: clip(input.source, 60)?.toLowerCase() ?? "direct",
      referrer: clip(input.referrer, 120)?.toLowerCase().replace(/^www\./, "") ?? null,
      campaign: clip(input.campaign, 60)?.toLowerCase() ?? null,
      country: clip(headers.get("x-vercel-ip-country"), 2),
      device,
      browser,
      os,
      locale: input.locale === "fr" ? "fr" : "en",
    },
  });
}

// Robot qui charge une page (enregistré par la mise en page du site, côté serveur)
export async function recordBotView(name: string, headers: Headers) {
  await db.pageView.create({
    data: { visitor: visitorId(headers), path: "", bot: name, country: clip(headers.get("x-vercel-ip-country"), 2), device: "desktop" },
  });
}

// Recherche dans le catalogue (une seule fois par visiteur et par terme en 30 minutes)
export async function recordSearch(headers: Headers, term: string, results: number) {
  const clean = term.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
  if (clean.length < 2) return;
  const visitor = visitorId(headers);
  const recent = await db.searchLog.count({ where: { visitor, term: clean, createdAt: { gte: new Date(Date.now() - 30 * 60_000) } } });
  if (!recent) await db.searchLog.create({ data: { visitor, term: clean, results } });
}

// Nettoyage quotidien : on ne garde que 13 mois
export async function purgeOldAnalytics() {
  const before = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  await Promise.all([db.pageView.deleteMany({ where: { createdAt: { lt: before } } }), db.searchLog.deleteMany({ where: { createdAt: { lt: before } } })]);
}
