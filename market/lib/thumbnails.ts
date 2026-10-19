import "server-only";

// Générateur d'images pour thumbnails Roblox (test réservé à la modération), via Cloudflare Workers AI.
// Clés : CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_AI_TOKEN (jeton avec la permission « Workers AI »).
// Gratuit jusqu'à 10 000 « neurons » par jour (remis à zéro à minuit UTC), ensuite les requêtes échouent.
// L'IA dessine seulement l'image : le titre est posé par-dessus dans le navigateur (les modèles écrivent mal).

export type ThumbModelId = "flux-1-schnell" | "flux-2-klein-4b" | "lucid-origin";

export const THUMB_MODELS: Record<ThumbModelId, { id: string; name: string; perDay: number }> = {
  // perDay : nombre approximatif d'images par jour avec le quota gratuit (tarifs Cloudflare)
  "flux-1-schnell": { id: "@cf/black-forest-labs/flux-1-schnell", name: "FLUX.1 schnell", perDay: 100 },
  "flux-2-klein-4b": { id: "@cf/black-forest-labs/flux-2-klein-4b", name: "FLUX.2 klein", perDay: 60 },
  "lucid-origin": { id: "@cf/leonardo/lucid-origin", name: "Leonardo Lucid Origin", perDay: 2 },
};

export const hasThumbKeys = () => Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_TOKEN);

// Styles proposés : ajoutés à la description de la scène
export const THUMB_STYLES = {
  simulator: "bright colorful simulator game, cheerful, glowing coins and gems flying around",
  tycoon: "tycoon game, big factory and conveyor belts, money everywhere, sunny day",
  obby: "obstacle course in the sky, floating platforms, lava below, dynamic action",
  horror: "dark horror game, foggy night, eerie lights, tense atmosphere",
  battle: "epic battle game, energy blasts, sparks, intense action pose",
  pets: "cute pet collection game, adorable fluffy pets, pastel colors, sparkles",
} as const;
export type ThumbStyle = keyof typeof THUMB_STYLES;

const BASE =
  "3D video game key art in a blocky toy style: characters with cube heads, rectangular bodies and simple smiling faces, glossy plastic look, " +
  "vivid saturated colors, strong rim lighting, cinematic composition, the main subject large in the foreground, clean background depth. " +
  "No text, no letters, no logos, no watermark, no UI.";

export function buildPrompt(scene: string, style: ThumbStyle) {
  return `${scene.trim().slice(0, 600)}. ${THUMB_STYLES[style]}. ${BASE}`;
}

export class ThumbError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Génère l'image et la renvoie en base64 (JPEG ou PNG selon le modèle)
export async function generateThumbnail(opts: { model: ThumbModelId; prompt: string; wide: boolean; seed?: number }) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_TOKEN;
  if (!account || !token) throw new ThumbError(503, "Clés Cloudflare manquantes");
  const model = THUMB_MODELS[opts.model];
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model.id}`;
  // 16:9 pour une thumbnail, carré pour une icône (multiples de 16)
  const [width, height] = opts.wide ? [1344, 768] : [1024, 1024];
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);

  let init: RequestInit;
  if (opts.model === "flux-2-klein-4b") {
    // FLUX.2 attend un formulaire « multipart »
    const form = new FormData();
    form.append("prompt", opts.prompt);
    form.append("width", String(width));
    form.append("height", String(height));
    form.append("seed", String(seed));
    init = { body: form };
  } else if (opts.model === "lucid-origin") {
    init = { body: JSON.stringify({ prompt: opts.prompt, width, height, seed, steps: 20 }), headers: { "content-type": "application/json" } };
  } else {
    // FLUX.1 schnell : image carrée seulement, recadrée ensuite dans le navigateur
    init = { body: JSON.stringify({ prompt: opts.prompt, steps: 8 }), headers: { "content-type": "application/json" } };
  }

  const res = await fetch(url, {
    method: "POST",
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(55_000),
  }).catch((err: Error) => {
    throw new ThumbError(504, `Cloudflare injoignable : ${err.message}`);
  });
  const text = await res.text();
  let json: { result?: { image?: string }; errors?: { message?: string }[] } = {};
  try {
    json = JSON.parse(text);
  } catch {
    // réponse vide ou non JSON : traitée plus bas
  }
  if (!res.ok || !json.result?.image) {
    const message = json.errors?.map((e) => e.message).join(" · ") || text.slice(0, 200) || `HTTP ${res.status}`;
    throw new ThumbError(res.status === 429 ? 429 : res.ok ? 502 : res.status, message);
  }
  const image = json.result.image;
  // Le modèle renvoie du JPEG ou du PNG en base64 : on regarde les premiers octets
  const mime = image.startsWith("iVBOR") ? "image/png" : "image/jpeg";
  return { dataUrl: `data:${mime};base64,${image}`, seed, width, height };
}
