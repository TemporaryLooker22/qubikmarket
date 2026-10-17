"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { publishResource } from "@/app/actions";
import { ALLOWED_EXTENSIONS, CATEGORIES, MAX_FORM_SIZE, MAX_IMAGES } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { SubmitButton } from "./SubmitButton";

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

export function SellForm() {
  const { t } = useI18n();
  const [state, formAction] = useActionState(publishResource, undefined);
  const [images, setImages] = useState<{ file: File; url: string }[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [localError, setLocalError] = useState<string>();

  // Libère les aperçus quand on quitte la page
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setCompressing(true);
    const room = MAX_IMAGES - images.length;
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    const compressed = await Promise.all(picked.map((f) => compressImage(f).catch(() => f)));
    setImages((prev) => [...prev, ...compressed.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    setCompressing(false);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(images[index].url);
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // On ajoute les images compressées au formulaire au moment de l'envoi
  const submit = (formData: FormData) => {
    setLocalError(undefined);
    formData.delete("images");
    images.forEach((i) => formData.append("images", i.file));
    const file = formData.get("file");
    const total = (file instanceof File ? file.size : 0) + images.reduce((n, i) => n + i.file.size, 0);
    if (total > MAX_FORM_SIZE) {
      setLocalError(t.errors.formTooBig);
      return;
    }
    return formAction(formData);
  };

  const error = localError ?? state?.error;

  return (
    <form action={submit}>
      {error && <p role="alert">{error}</p>}

      <p>
        <label htmlFor="title">{t.sell.fTitle}</label>
        <br />
        <input id="title" name="title" required maxLength={80} placeholder={t.sell.fTitlePh} />
      </p>

      <p>
        <label htmlFor="summary">{t.sell.fSummary}</label>
        <br />
        <input id="summary" name="summary" required maxLength={160} placeholder={t.sell.fSummaryPh} />
      </p>

      <p>
        <label htmlFor="description">{t.sell.fDescription}</label>
        <br />
        <textarea id="description" name="description" required rows={7} placeholder={t.sell.fDescriptionPh} />
      </p>

      <p>
        <label htmlFor="category">{t.sell.fCategory}</label>
        <br />
        <select id="category" name="category" required defaultValue="">
          <option value="" disabled>{t.sell.fCategoryPh}</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </p>

      <p>
        <label htmlFor="price">{t.sell.fPrice}</label>
        <br />
        <input id="price" name="price" type="number" min={0} max={500} step="0.01" defaultValue={0} required />
      </p>

      <p>
        <label htmlFor="file">{t.sell.fFile(ALLOWED_EXTENSIONS.join(", "))}</label>
        <br />
        <input id="file" name="file" type="file" required accept={ALLOWED_EXTENSIONS.join(",")} />
      </p>

      {/* Captures d'écran : compressées dans le navigateur, puis ajoutées au formulaire à l'envoi */}
      <div>
        <label htmlFor="images">{t.sell.fImages(MAX_IMAGES)}</label>
        <p className="mt-1 text-xs text-muted">{t.sell.fImagesHelp}</p>
        {images.length > 0 && (
          <div className="mt-2 grid max-w-md grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={img.url} className={`relative aspect-video overflow-hidden rounded-lg bg-surface ${i === 0 ? "ring-2 ring-accent" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label={t.sell.removeImage}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-text/80 text-bg"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {images.length < MAX_IMAGES && (
          <input
            id="images"
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              addImages(e.target.files);
              e.target.value = "";
            }}
            className="mt-2 block text-sm"
          />
        )}
        {compressing && <p className="mt-1 text-xs text-muted">{t.sell.compressing}</p>}
      </div>

      <p>{t.sell.next}</p>
      <ul>
        <li>{t.sell.nextClean}</li>
        <li>{t.sell.nextSuspicious}</li>
        <li>{t.sell.nextDangerous}</li>
      </ul>

      <SubmitButton pendingText={t.sell.submitting}>{t.sell.submit}</SubmitButton>
    </form>
  );
}
