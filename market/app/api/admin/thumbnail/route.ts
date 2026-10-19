import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isRobloxImage } from "@/lib/roblox-refs";
import { buildPrompt, describeReferences, generateThumbnail, MAX_REFS, THUMB_MODELS, THUMB_STYLES, ThumbError, withStyleGuide, type ThumbModelId, type ThumbStyle } from "@/lib/thumbnails";

export const maxDuration = 60;

// Modération → Thumbnails : génère une image avec Cloudflare Workers AI (admins seulement, outil de test).
// Avec des images de référence (miniatures de jeux Roblox choisies dans la galerie), une IA de vision en décrit
// d'abord le style ; le générateur reçoit seulement ce texte. Le guide déjà calculé peut être renvoyé par la page
// (bouton « Une autre » avec les mêmes références) pour ne pas refaire l'analyse.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { scene?: string; style?: string; model?: string; wide?: boolean; seed?: number; references?: unknown; guide?: unknown };
  const scene = String(body.scene ?? "").trim();
  if (scene.length < 3) return NextResponse.json({ error: "Décris la scène" }, { status: 400 });
  const references = (Array.isArray(body.references) ? body.references : []).filter((u): u is string => typeof u === "string" && isRobloxImage(u)).slice(0, MAX_REFS);
  const model = (body.model && body.model in THUMB_MODELS ? body.model : "flux-1-schnell") as ThumbModelId;
  const style = (body.style && body.style in THUMB_STYLES ? body.style : "simulator") as ThumbStyle;
  const wide = body.wide !== false;

  const started = Date.now();
  try {
    const known = typeof body.guide === "string" && body.guide.trim() ? body.guide.trim().slice(0, 900) : null;
    const guide = references.length ? (known ?? (await describeReferences(references))) : null;
    const prompt = withStyleGuide(buildPrompt(scene, style, wide), guide);
    const seed = Number.isInteger(body.seed) && body.seed! >= 0 ? body.seed : undefined;
    const image = await generateThumbnail({ model, prompt, wide, seed });
    return NextResponse.json({ ...image, model, prompt, guide, ms: Date.now() - started }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const status = err instanceof ThumbError ? err.status : 500;
    console.error("Thumbnail Cloudflare :", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message, status }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
