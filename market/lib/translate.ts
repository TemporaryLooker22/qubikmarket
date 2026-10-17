import "server-only";
import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import type { Locale } from "./i18n/dictionaries";

// Traduction automatique des textes écrits par les vendeurs (résumé et description des ressources).
// - DeepL si DEEPL_API_KEY est défini (meilleure qualité, 500 000 caractères gratuits par mois)
// - sinon MyMemory : gratuit et sans compte, mais limité (environ 5 000 caractères par jour,
//   50 000 si MYMEMORY_EMAIL est défini)
// Chaque texte traduit est gardé en cache : il n'est traduit qu'une seule fois.

const DEEPL_KEY = process.env.DEEPL_API_KEY;
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL;
const TIMEOUT_MS = 5000;
const MYMEMORY_MAX = 450; // MyMemory refuse les textes de plus de 500 octets
// À augmenter si on change la façon de traduire : les anciennes traductions en cache seront ignorées
const CACHE_VERSION = "2";

// Le site est en anglais par défaut : on suppose que les vendeurs écrivent en anglais
const SOURCE: Record<Locale, Locale> = { fr: "en", en: "fr" };

// Traduit un texte (Markdown) vers la langue demandée. En cas d'échec, renvoie le texte d'origine.
export async function translate(text: string, target: Locale): Promise<{ text: string; translated: boolean }> {
  if (!text.trim()) return { text, translated: false };
  const key = createHash("sha1").update(text).digest("hex");
  try {
    const result = await cachedTranslate(text, target, key, DEEPL_KEY ? "deepl" : "mymemory");
    return { text: result, translated: result.trim() !== text.trim() };
  } catch (err) {
    console.warn("Traduction impossible, texte original affiché :", (err as Error).message);
    return { text, translated: false };
  }
}

// Mise en cache (permanente) du résultat. Une erreur n'est jamais mise en cache : on réessaiera plus tard.
const cachedTranslate = (text: string, target: Locale, key: string, provider: string) =>
  unstable_cache(() => translateMarkdown(text, target), ["translate", CACHE_VERSION, provider, target, key], { revalidate: false })();

// Traduit ligne par ligne en gardant la mise en forme : marqueurs de titre/liste conservés, blocs de code intacts
async function translateMarkdown(text: string, target: Locale): Promise<string> {
  const lines = text.split("\n");
  const jobs: { index: number; prefix: string; content: string }[] = [];
  let inCode = false;
  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) inCode = !inCode;
    if (inCode || line.trim().startsWith("```") || !line.trim()) return;
    const [, prefix, content] = line.match(/^(\s*(?:#{1,6}\s+|[-*+]\s+|\d+\.\s+|>\s*)?)(.*)$/) ?? ["", "", line];
    if (/[a-zA-Z]/.test(content)) jobs.push({ index, prefix, content });
  });
  if (!jobs.length) return text;

  // La mise en forme Markdown (gras, code, liens) passe en balises HTML, que les traducteurs respectent
  const tagged = jobs.map((j) => toTags(j.content));
  const translated = DEEPL_KEY
    ? await deepl(tagged.map((t) => t.html), target)
    : await Promise.all(tagged.map((t) => myMemory(t.html, target)));
  jobs.forEach((job, i) => (lines[job.index] = job.prefix + fromTags(translated[i], tagged[i].urls)));
  return lines.join("\n");
}

// **gras** → <b>, *italique* → <i>, `code` → <code>, [texte](adresse) → <a href="0"> (l'adresse est mise de côté)
function toTags(md: string) {
  const urls: string[] = [];
  const html = md
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => `<a href="${urls.push(url) - 1}">${text}</a>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(\*\*|__)(.+?)\1/g, "<b>$2</b>")
    .replace(/(^|[^*\w])[*_]([^*_\s][^*_]*?)[*_](?![*\w])/g, "$1<i>$2</i>");
  return { html, urls };
}

function fromTags(html: string, urls: string[]) {
  return html
    .replace(/<a href="(\d+)">(.*?)<\/a>/g, (_, i, text) => `[${text}](${urls[Number(i)] ?? ""})`)
    .replace(/<code>(.*?)<\/code>/g, "`$1`")
    .replace(/<b>(.*?)<\/b>/g, "**$1**")
    .replace(/<i>(.*?)<\/i>/g, "*$1*")
    .replace(/<\/?(?:a|b|i|code)[^>]*>/g, ""); // balises restées orphelines
}

async function deepl(texts: string[], target: Locale): Promise<string[]> {
  // Les clés gratuites finissent par « :fx » et utilisent une autre adresse
  const host = DEEPL_KEY!.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  const res = await fetch(`https://${host}/v2/translate`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texts, target_lang: target.toUpperCase(), tag_handling: "html" }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`DeepL : erreur ${res.status}`);
  const data = (await res.json()) as { translations: { text: string }[] };
  return data.translations.map((t) => t.text);
}

async function myMemory(text: string, target: Locale): Promise<string> {
  const parts = splitForMyMemory(text);
  const out = await Promise.all(
    parts.map(async (part) => {
      const params = new URLSearchParams({ q: part, langpair: `${SOURCE[target]}|${target}` });
      if (MYMEMORY_EMAIL) params.set("de", MYMEMORY_EMAIL);
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`MyMemory : erreur ${res.status}`);
      const data = (await res.json()) as { responseStatus: number | string; responseData?: { translatedText?: string } };
      const result = data.responseData?.translatedText ?? "";
      // Quota du jour dépassé ou autre problème : MyMemory renvoie un message à la place de la traduction
      if (Number(data.responseStatus) !== 200 || !result || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(result)) {
        throw new Error(`MyMemory : ${result || data.responseStatus}`);
      }
      return decodeEntities(result);
    }),
  );
  return out.join(" ");
}

// Coupe un texte trop long en morceaux de phrases complètes
function splitForMyMemory(text: string): string[] {
  if (text.length <= MYMEMORY_MAX) return [text];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const parts: string[] = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > MYMEMORY_MAX && current) {
      parts.push(current.trim());
      current = "";
    }
    current += s.length > MYMEMORY_MAX ? s.slice(0, MYMEMORY_MAX) : s;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

// MyMemory renvoie parfois des entités HTML (ex. l&#39;inventaire)
function decodeEntities(s: string) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
