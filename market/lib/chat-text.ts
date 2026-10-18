// Règles de la messagerie partagées entre le serveur et le navigateur (pas de "server-only" ici)

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_MAX_IMAGES = 4;
export const CHAT_IMAGE_MAX_SIDE = 2048; // les images sont réduites dans le navigateur avant l'envoi
export const CHAT_POLL_MS = 3000; // conversation ouverte : nouveaux messages toutes les 3 s
export const CHAT_COUNT_POLL_MS = 30_000; // icône de la barre de navigation : non-lus toutes les 30 s
export const ONLINE_MS = 5 * 60 * 1000; // « en ligne » : actif dans les 5 dernières minutes
export const REPORT_REASONS = ["SCAM", "OFF_PLATFORM", "HARASSMENT", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// Paiement ou contact en dehors de Qubik (en français et en anglais). Le message part quand même :
// on affiche seulement une alerte « Paie toujours sur Qubik ». Discord et Robux sont des sujets normaux
// sur un marché Roblox : ils ne comptent que s'ils servent à payer ou à continuer la discussion ailleurs.
const OFF_PLATFORM = [
  /\bpay\s?pal\b/i,
  /\bpaypal\.me\b/i,
  /\bcash\s?app\b/i,
  /\bvenmo\b/i,
  /\brevolut\b/i,
  /\bzelle\b/i,
  /\bskrill\b/i,
  /\blydia\b/i,
  /\bpayconiq\b/i,
  /\biban\b/i,
  /\bvirement\b/i,
  /\bbank\s+transfer\b/i,
  /\bwire\s+transfer\b/i,
  /\b(bitcoin|btc|ethereum|eth|usdt|crypto)\b/i,
  /\b(gift\s?cards?|cartes?[\s-]cadeaux?)\b/i,
  /\bdiscord\.(gg|com\/invite)\b/i,
  /\b(add|dm|message|contact|ajoute|écris|ecris|mp)\b[^.!?\n]{0,25}\bdiscord\b/i,
  /\bdiscord\b[^.!?\n]{0,25}\b(dm|mp|add|ajoute|contact)\b/i,
  /\b(telegram|whatsapp|snapchat)\b/i,
  /\b(pay|paie|payer|payez|send|envoie|envoyer|give|donne)\b[^.!?\n]{0,25}\brobux\b/i,
  /\brobux\b[^.!?\n]{0,25}\b(instead|à la place|plutôt|plutot)\b/i,
  /\b(outside|off)[\s-](of\s+)?(qubik|the\s+site|platform)\b/i,
  /\bhors\s+(de\s+)?(qubik|du\s+site|plateforme)\b/i,
];

export function mentionsOffPlatform(text: string) {
  return OFF_PLATFORM.some((re) => re.test(text));
}

// Liens cliquables seulement vers Qubik et Roblox ; les autres adresses restent du texte
const SAFE_HOSTS = ["qubikmarket.com", "roblox.com"];
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/gi;

export type TextPart = { text: string; href?: string };

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    let href: string | undefined;
    try {
      const host = new URL(match[0]).hostname.toLowerCase();
      if (SAFE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) href = match[0];
    } catch {
      // adresse invalide : reste du texte
    }
    parts.push({ text: match[0], href });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// Temps de réponse habituel (médiane en millisecondes) → libellé court
export type ResponseBucket = "hour" | "hours" | "day" | "days";
export function responseBucket(ms: number): ResponseBucket {
  if (ms <= 60 * 60 * 1000) return "hour";
  if (ms <= 6 * 60 * 60 * 1000) return "hours";
  if (ms <= 24 * 60 * 60 * 1000) return "day";
  return "days";
}
