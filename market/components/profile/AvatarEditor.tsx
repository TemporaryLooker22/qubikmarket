"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { uploadImage } from "@/lib/upload-client";
import { removeAvatar, setAvatar } from "@/app/member-actions";
import { UserAvatar } from "@/components/UserAvatar";

const VIEW = 240; // taille du cadre de recadrage à l'écran
const MARGIN = 20; // espace autour du cercle
const OUTPUT = 512; // taille de la photo enregistrée (carrée, WebP)

// Paramètres → photo de profil : on choisit une image, on la déplace et on zoome pour la placer
// dans le cercle, puis la photo recadrée (512 × 512) est envoyée dans le stockage et enregistrée.
export function AvatarEditor({ username, current, canUpload }: { username: string; current: string | null; canUpload: boolean }) {
  const { t } = useI18n();
  const s = t.profile.settings;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // Taille de l'image affichée : elle couvre toujours le cercle, puis le zoom l'agrandit
  const circle = VIEW - 2 * MARGIN;
  const base = image ? circle / Math.min(image.naturalWidth, image.naturalHeight) : 1;
  const w = image ? image.naturalWidth * base * zoom : 0;
  const h = image ? image.naturalHeight * base * zoom : 0;
  // L'image ne doit jamais laisser de vide dans le cercle
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.min(Math.max(o.x, -(w - circle) / 2), (w - circle) / 2),
    y: Math.min(Math.max(o.y, -(h - circle) / 2), (h - circle) / 2),
  });
  useEffect(() => setOffset((o) => clamp(o)), [zoom, image]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setState("idle");
    };
    img.src = URL.createObjectURL(file);
  };

  const save = async () => {
    if (!image) return;
    setState("saving");
    try {
      // Recadre exactement ce qui est dans le cercle
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUTPUT;
      const scale = OUTPUT / circle;
      const left = (VIEW - w) / 2 + offset.x - MARGIN;
      const top = (VIEW - h) / 2 + offset.y - MARGIN;
      canvas.getContext("2d")!.drawImage(image, left * scale, top * scale, w * scale, h * scale);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.9));
      if (!blob) throw new Error("image");
      const url = await uploadImage(new File([blob], "avatar.webp", { type: "image/webp" }));
      const result = await setAvatar(url);
      if (!result.ok) throw new Error("save");
      setImage(null);
      setState("saved");
      router.refresh();
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex flex-col items-center">
      {image ? (
        <>
          <div
            className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-surface active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            }}
            onPointerMove={(e) => {
              if (drag.current) setOffset(clamp({ x: drag.current.ox + e.clientX - drag.current.x, y: drag.current.oy + e.clientY - drag.current.y }));
            }}
            onPointerUp={() => (drag.current = null)}
            onWheel={(e) => setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY / 500)))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{ width: w, height: h, left: (VIEW - w) / 2 + offset.x, top: (VIEW - h) / 2 + offset.y }}
            />
            <span className="pointer-events-none absolute rounded-full border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.45)]" style={{ inset: MARGIN }} />
          </div>
          <label className="mt-4 flex w-60 items-center gap-2.5 text-muted">
            <ZoomOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={s.zoom} className="w-full accent-[var(--color-text)]" />
            <ZoomIn className="h-4 w-4 shrink-0" aria-hidden="true" />
          </label>
        </>
      ) : (
        <UserAvatar name={username} src={current} size={160} className="text-5xl" />
      )}

      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {canUpload && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => input.current?.click()} className="btn-ghost px-4 py-2 text-sm">
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {image || current ? s.change : s.choose}
          </button>
          {image && (
            <button type="button" onClick={save} disabled={state === "saving"} className="btn-accent rounded-xl px-5 py-2 text-sm disabled:opacity-60">
              {state === "saving" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {state === "saving" ? s.saving : s.save}
            </button>
          )}
        </div>
      )}
      {state === "saved" && (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-ok">
          <Check className="h-4 w-4" aria-hidden="true" /> {s.saved}
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-bad">
          {s.error}
        </p>
      )}
      {current && !image && (
        <form action={removeAvatar} className="mt-3">
          <button className="text-xs text-muted underline underline-offset-2 hover:text-bad">{s.remove}</button>
        </form>
      )}
    </div>
  );
}
