import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildPrompt, generateThumbnail, THUMB_MODELS, THUMB_STYLES, ThumbError, type ThumbModelId, type ThumbStyle } from "@/lib/thumbnails";

export const maxDuration = 60;

// Modération → Thumbnails : génère une image avec Cloudflare Workers AI (admins seulement, outil de test)
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { scene?: string; style?: string; model?: string; wide?: boolean; seed?: number };
  const scene = String(body.scene ?? "").trim();
  if (scene.length < 3) return NextResponse.json({ error: "Décris la scène" }, { status: 400 });
  const model = (body.model && body.model in THUMB_MODELS ? body.model : "flux-1-schnell") as ThumbModelId;
  const style = (body.style && body.style in THUMB_STYLES ? body.style : "simulator") as ThumbStyle;

  const started = Date.now();
  try {
    const prompt = buildPrompt(scene, style);
    const seed = Number.isInteger(body.seed) && body.seed! >= 0 ? body.seed : undefined;
    const image = await generateThumbnail({ model, prompt, wide: body.wide !== false, seed });
    return NextResponse.json({ ...image, model, prompt, ms: Date.now() - started }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const status = err instanceof ThumbError ? err.status : 500;
    console.error("Thumbnail Cloudflare :", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message, status }, { status: status >= 400 && status < 600 ? status : 500 });
  }
}
