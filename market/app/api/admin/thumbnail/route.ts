import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isRobloxImage } from "@/lib/roblox-refs";
import { buildPrompt, generateThumbnail, MAX_REFS, THUMB_MODELS, THUMB_STYLES, ThumbError, withReferences, type ThumbModelId, type ThumbStyle } from "@/lib/thumbnails";

export const maxDuration = 60;

// Modération → Thumbnails : génère une image avec Cloudflare Workers AI (admins seulement, outil de test).
// Avec des images de référence (miniatures de jeux Roblox choisies dans la galerie), FLUX.2 klein est utilisé : c'est
// le seul des trois modèles qui sait les regarder.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { scene?: string; style?: string; model?: string; wide?: boolean; seed?: number; references?: unknown };
  const scene = String(body.scene ?? "").trim();
  if (scene.length < 3) return NextResponse.json({ error: "Décris la scène" }, { status: 400 });
  const references = (Array.isArray(body.references) ? body.references : []).filter((u): u is string => typeof u === "string" && isRobloxImage(u)).slice(0, MAX_REFS);
  const model = (references.length ? "flux-2-klein-4b" : body.model && body.model in THUMB_MODELS ? body.model : "flux-1-schnell") as ThumbModelId;
  const style = (body.style && body.style in THUMB_STYLES ? body.style : "simulator") as ThumbStyle;

  const started = Date.now();
  try {
    const prompt = buildPrompt(scene, style, body.wide !== false);
    const seed = Number.isInteger(body.seed) && body.seed! >= 0 ? body.seed : undefined;
    const image = await generateThumbnail({ model, prompt, wide: body.wide !== false, seed, references });
    return NextResponse.json(
      { ...image, model, prompt: withReferences(prompt, references.length), references: references.length, ms: Date.now() - started },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    const status = err instanceof ThumbError ? err.status : 500;
    console.error("Thumbnail Cloudflare :", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message, status }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
