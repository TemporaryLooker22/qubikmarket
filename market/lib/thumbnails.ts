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

// Guide de style tiré de l'observation des miniatures et icônes des jeux Roblox les plus joués (octobre 2026,
// listes Top Trending / Top Playing Now). Seules les tendances générales sont gardées, aucune image n'est copiée :
// - un seul héros très grand au premier plan (souvent un avatar en blocs à l'expression exagérée : sourire
//   déterminé, choc, rire), vu de près en contre-plongée, en pleine action figée (traits de vitesse, débris, étincelles)
// - l'objet convoité bien visible à côté du héros (œuf brillant, coffre, gemmes, voiture, animal rare), souvent lumineux
// - rendu 3D type Blender : lumière douce, contour lumineux sur les bords, arrière-plan légèrement flou
// - couleurs très saturées et contrastées : ciel bleu vif et herbe verte pour les jeux joyeux, violet et orange
//   pour Halloween, sombre avec une seule source de lumière pour l'horreur
// - le texte (1 à 4 mots, police épaisse à gros contour, chiffres énormes, « UPDATE », rareté) est ajouté
//   par-dessus par le site, jamais par l'IA
// - icône carrée : un seul sujet cadré serré qui remplit l'image, lisible en tout petit, fond simple et coloré

// Styles proposés : ajoutés à la description de la scène
export const THUMB_STYLES = {
  simulator:
    "simulator game: the hero triumphantly holding a glowing rare reward, huge piles of shiny coins and gems bursting around, bright blue sky, green grass, cheerful energy",
  tycoon: "tycoon game: the hero proudly in front of a huge colorful factory with conveyor belts, stacks of cash flying, sunny day, sense of growth and wealth",
  obby: "obstacle course in the sky: the hero mid-jump between floating platforms, glowing lava far below, speed lines, dramatic low angle",
  horror:
    "horror game: dark corridor or foggy night, a terrifying monster looming behind a frightened hero, single cold light source, strong shadows, tense atmosphere",
  battle: "battlegrounds fighting game: two fighters clashing, glowing energy blast, shockwave, sparks and debris, intense anime-style action pose",
  pets: "pet collection game: adorable fluffy pets with big shiny eyes around a glowing legendary egg, pastel colors, sparkles, joyful mood",
  racing: "racing game: a shiny sports car drifting toward the camera, tire smoke, motion blur, sunset road, dynamic perspective",
  halloween: "Halloween update: glowing jack-o'-lanterns, purple and orange night sky, full moon, bats, playful spooky mood",
} as const;
export type ThumbStyle = keyof typeof THUMB_STYLES;

const LOOK =
  "3D rendered video game key art in a blocky toy style: characters with cube heads, rectangular bodies and very expressive cartoon faces, " +
  "glossy plastic materials, soft global illumination with a bright rim light, vivid saturated colors, high contrast, slight depth of field on the background.";
const COMPOSITION = {
  wide: "Wide 16:9 composition: the hero large in the foreground on one side, the coveted object or threat clearly visible on the other side, dynamic low angle, frozen mid-action moment, empty space at the top or bottom for a title.",
  square: "Square icon composition: one single subject cropped tight and filling the frame, readable at very small size, simple colorful background.",
};
const FORBIDDEN = "No text, no letters, no numbers, no logos, no watermark, no user interface, no real brands, no existing copyrighted characters.";

export function buildPrompt(scene: string, style: ThumbStyle, wide = true) {
  return `${scene.trim().slice(0, 600)}. ${THUMB_STYLES[style]}. ${LOOK} ${wide ? COMPOSITION.wide : COMPOSITION.square} ${FORBIDDEN}`;
}

export class ThumbError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_REFS = 4;

// Images de référence : une IA de vision (Llama 4 Scout, Cloudflare) les regarde et décrit leur style en texte.
// Le générateur ne reçoit que ce texte : envoyer les images elles-mêmes à FLUX.2 déclenchait son filtre de sécurité
// (logos, personnages connus, visages réalistes dans les miniatures des jeux populaires).
const VISION_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

// Télécharge une image de référence et la réduit (moins de données à envoyer à l'IA de vision)
async function referenceDataUrl(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new ThumbError(400, `Image de référence illisible (${res.status})`);
  const sharp = (await import("sharp")).default;
  const jpg = await sharp(Buffer.from(await res.arrayBuffer())).resize(640, 640, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

const VISION_PROMPT =
  "These images are Roblox game thumbnails used as style references for a new, original thumbnail. " +
  "Write one style guide (110 words max, plain English, no lists, no intro) that an image generator can follow: " +
  "color palette and saturation, lighting, rendering style, camera angle and framing, how the main character is posed and drawn, " +
  "background, visual effects (speed lines, glow, particles), mood and composition tricks they share. " +
  "Describe only visual style. Never mention game names, brands, logos, text, words, numbers, real people or known characters.";

export async function describeReferences(urls: string[]) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_AI_TOKEN;
  if (!account || !token) throw new ThumbError(503, "Clés Cloudflare manquantes");
  const images = await Promise.all(urls.slice(0, MAX_REFS).map(referenceDataUrl));
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    signal: AbortSignal.timeout(40_000),
    body: JSON.stringify({
      model: VISION_MODEL,
      max_tokens: 300,
      temperature: 0.2,
      messages: [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))] }],
    }),
  }).catch((err: Error) => {
    throw new ThumbError(504, `Cloudflare injoignable : ${err.message}`);
  });
  const text = await res.text();
  if (!res.ok) throw new ThumbError(res.status === 429 ? 429 : 502, `Analyse des références : ${text.slice(0, 200)}`);
  const content = JSON.parse(text).choices?.[0]?.message?.content;
  const guide = String(content ?? "").replace(/\s+/g, " ").trim();
  if (!guide) throw new ThumbError(502, "Analyse des références : réponse vide");
  return guide.slice(0, 900);
}

// Ajoute le guide de style tiré des références, en gardant la consigne sous la limite de FLUX.1 (2048 caractères)
export function withStyleGuide(prompt: string, guide: string | null) {
  if (!guide) return prompt.slice(0, 2000);
  const full = `${prompt} Match this reference style: ${guide}`;
  return full.length <= 2000 ? full : `${prompt.slice(0, 2000 - guide.length - 32)} Match this reference style: ${guide}`;
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
    const message = (json.errors?.map((e) => e.message).join(" · ") || text.slice(0, 200) || `HTTP ${res.status}`).replace(/^(AiError:\s*)+/, "");
    // Filtre de sécurité du modèle : l'image produite a été bloquée (personnage connu, visage réaliste, violence…)
    if (/flagged/i.test(message)) throw new ThumbError(422, "flagged");
    throw new ThumbError(res.status === 429 ? 429 : res.ok ? 502 : res.status, message);
  }
  const image = json.result.image;
  // Le modèle renvoie du JPEG ou du PNG en base64 : on regarde les premiers octets
  const mime = image.startsWith("iVBOR") ? "image/png" : "image/jpeg";
  return { dataUrl: `data:${mime};base64,${image}`, seed, width, height };
}
