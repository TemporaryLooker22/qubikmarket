"use client";

import { useRef, useState } from "react";
import { ArrowLeft, GripVertical, ImagePlus, Loader2, X } from "lucide-react";
import { MAX_IMAGES } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";

export type PickedImage = { file: File; url: string };

// Réduit une image (1600 px de large maximum) et la convertit en WebP, pour tenir dans la limite d'envoi de Vercel
async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
}

// Captures d'écran : compressées dans le navigateur, réordonnables par glisser-déposer.
// La première sert de miniature dans le catalogue.
export function ImagePicker({ images, onChange }: { images: PickedImage[]; onChange: (images: PickedImage[]) => void }) {
  const { t } = useI18n();
  const [compressing, setCompressing] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setCompressing(true);
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES - images.length);
    const compressed = await Promise.all(picked.map((f) => compressImage(f).catch(() => f)));
    onChange([...images, ...compressed.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setCompressing(false);
  };

  const remove = (index: number) => {
    URL.revokeObjectURL(images[index].url);
    onChange(images.filter((_, i) => i !== index));
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...images];
    const [img] = next.splice(from, 1);
    next.splice(to, 0, img);
    onChange(next);
  };

  return (
    <div
      // Des images déposées depuis l'ordinateur sur la grille sont ajoutées
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (dragFrom.current === null) addFiles(e.dataTransfer.files);
      }}
    >
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {images.map((img, i) => (
          <div
            key={img.url}
            draggable
            onDragStart={() => (dragFrom.current = i)}
            onDragEnter={() => dragFrom.current !== null && setDragOver(i)}
            onDragEnd={() => {
              dragFrom.current = null;
              setDragOver(null);
            }}
            onDrop={(e) => {
              if (dragFrom.current === null) return;
              e.preventDefault();
              e.stopPropagation();
              move(dragFrom.current, i);
              dragFrom.current = null;
              setDragOver(null);
            }}
            className={`group relative aspect-video cursor-grab overflow-hidden rounded-xl bg-surface transition active:cursor-grabbing ${
              i === 0 ? "outline-2 outline-offset-2 outline-accent" : ""
            } ${dragOver === i ? "scale-[0.97] opacity-70" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="h-full w-full object-cover" draggable={false} />
            <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-card/85 text-muted">
              <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            {i === 0 && (
              <span className="absolute bottom-1.5 left-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold">{t.sell.thumbnail}</span>
            )}
            {/* Au clavier ou sur téléphone (pas de glisser-déposer) : avancer l'image d'une place */}
            {i > 0 && (
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                aria-label={t.sell.moveImage}
                title={t.sell.moveImage}
                className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-text/80 text-bg opacity-0 transition focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t.sell.removeImage}
              title={t.sell.removeImage}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-text/80 text-bg transition hover:bg-text"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}

        {images.length < MAX_IMAGES && (
          <label className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-border-strong bg-bg text-center text-xs font-semibold text-muted transition hover:border-text hover:text-text focus-within:border-text focus-within:ring-4 focus-within:ring-accent/30">
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {compressing ? <Loader2 className="mb-1 h-5 w-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="mb-1 h-5 w-5" aria-hidden="true" />}
            {compressing ? t.sell.compressing : t.sell.addImage}
            <span className="font-medium">
              {images.length} / {MAX_IMAGES}
            </span>
          </label>
        )}
      </div>
      <p className="mt-2.5 text-xs text-muted">{t.sell.imagesHelp}</p>
    </div>
  );
}
