"use client";

import { startTransition, useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  updateResourceDescription,
  updateResourceImages,
  updateResourceInfo,
  updateResourcePrice,
  updateResourceVideo,
  type EditState,
} from "@/app/resource-actions";
import { MAX_FORM_SIZE } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { CategoryPicker } from "@/components/sell/CategoryPicker";
import { DescriptionEditor } from "@/components/sell/DescriptionEditor";
import { ImagePicker, type PickedImage } from "@/components/sell/ImagePicker";
import { parsePrice, PRICE, PriceField } from "@/components/sell/PriceField";
import { useFileUpload } from "@/components/sell/useFileUpload";
import { VideoField } from "@/components/sell/VideoField";
import { parseYouTubeId } from "@/lib/youtube";

// Formulaires des onglets Infos, Images, Description et Prix de la page « Modifier une ressource ».
// Chaque onglet s'enregistre séparément, sans nouveau scan (le fichier ne change pas).

export const inputClass =
  "h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[15px] outline-none transition placeholder:text-muted focus:border-text focus:ring-4 focus:ring-accent/30";

// Envoi sans action de formulaire directe : React ne vide pas les champs après l'enregistrement
function useEditAction(action: (state: EditState, formData: FormData) => Promise<EditState>) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const submit = (build: () => FormData) => startTransition(() => formAction(build()));
  return { state, pending, submit };
}

// Bas de chaque onglet : message (erreur ou « Enregistré ») et bouton Enregistrer
export function SaveBar({ state, pending, note, localError }: { state: EditState; pending: boolean; note?: string; localError?: string }) {
  const { t } = useI18n();
  const error = localError ?? state?.error;
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
      {error ? (
        <p role="alert" className="mr-auto text-sm font-medium text-bad">
          {error}
        </p>
      ) : state?.ok && !pending ? (
        <p role="status" className="mr-auto flex items-center gap-1.5 text-sm font-medium text-ok">
          <Check className="h-4 w-4" aria-hidden="true" />
          {state.ok}
        </p>
      ) : (
        note && <p className="mr-auto text-xs text-muted">{note}</p>
      )}
      <button type="submit" disabled={pending} className="btn-accent rounded-xl px-5 py-2.5 disabled:opacity-60">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
        {pending ? t.edit.saving : t.edit.save}
      </button>
    </div>
  );
}

export function InfoForm({ resourceId, initial }: { resourceId: string; initial: { title: string; summary: string; category: string } }) {
  const { t } = useI18n();
  const { state, pending, submit } = useEditAction(updateResourceInfo);
  const [title, setTitle] = useState(initial.title);
  const [summary, setSummary] = useState(initial.summary);
  const [category, setCategory] = useState(initial.category);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => {
          const fd = new FormData();
          fd.set("resourceId", resourceId);
          fd.set("title", title);
          fd.set("summary", summary);
          fd.set("category", category);
          return fd;
        });
      }}
      className="space-y-4"
    >
      <Field id="title" label={t.sell.fTitle} count={`${title.length} / 80`}>
        <input id="title" required minLength={4} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </Field>
      <Field id="summary" label={t.sell.fSummary} count={`${summary.length} / 160`} help={t.sell.fSummaryHelp}>
        <input id="summary" required minLength={10} maxLength={160} value={summary} onChange={(e) => setSummary(e.target.value)} className={inputClass} />
      </Field>
      <CategoryPicker value={category} onChange={setCategory} />
      <SaveBar state={state} pending={pending} note={t.edit.instantNote} />
    </form>
  );
}

export function ImagesForm({ resourceId, initial, directUpload }: { resourceId: string; initial: string[]; directUpload: boolean }) {
  const { t } = useI18n();
  const { state, pending, submit } = useEditAction(updateResourceImages);
  const [images, setImages] = useState<PickedImage[]>(initial.map((url) => ({ url })));
  const [localError, setLocalError] = useState<string>();
  const upload = useFileUpload(directUpload);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setLocalError(undefined);
        const fd = new FormData();
        fd.set("resourceId", resourceId);
        // Ordre final : adresse d'une image existante ; nouvelle image : « url:… » après l'envoi direct dans le stockage
        // (jusqu'à 20 Mo), ou « new:N » pour la N-ième image envoyée avec le formulaire (en local)
        let order: string[];
        if (directUpload) {
          const urls = await upload.uploadImages(images.flatMap((i) => (i.file ? [i.file] : [])));
          if (!urls) return setLocalError(t.errors.uploadFailed);
          let n = 0;
          order = images.map((img) => (img.file ? `url:${urls[n++]}` : img.url));
        } else {
          const size = images.reduce((s, i) => s + (i.file?.size ?? 0), 0);
          if (size > MAX_FORM_SIZE) return setLocalError(t.errors.formTooBig);
          let n = 0;
          order = images.map((img) => {
            if (!img.file) return img.url;
            fd.append("images", img.file);
            return `new:${n++}`;
          });
        }
        fd.set("order", JSON.stringify(order));
        submit(() => fd);
      }}
    >
      <ImagePicker images={images} onChange={setImages} direct={directUpload} />
      {upload.imageStep && <p className="mt-3 text-sm text-muted">{t.sell.uploadingImages(upload.imageStep.done, upload.imageStep.total)}</p>}
      <SaveBar state={state} pending={pending || upload.imageStep !== null} note={t.edit.instantNote} localError={localError} />
    </form>
  );
}

export function DescriptionForm({ resourceId, initial }: { resourceId: string; initial: string }) {
  const { t } = useI18n();
  const { state, pending, submit } = useEditAction(updateResourceDescription);
  const [description, setDescription] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => {
          const fd = new FormData();
          fd.set("resourceId", resourceId);
          fd.set("description", description);
          return fd;
        });
      }}
    >
      <DescriptionEditor value={description} onChange={setDescription} />
      <SaveBar state={state} pending={pending} note={t.edit.instantNote} />
    </form>
  );
}

export function PriceForm({ resourceId, initialCents, feePercent, initialPromo }: { resourceId: string; initialCents: number; feePercent: number; initialPromo: number | null }) {
  const { t } = useI18n();
  const { state, pending, submit } = useEditAction(updateResourcePrice);
  const [paid, setPaid] = useState(initialCents > 0);
  const [price, setPrice] = useState(initialCents > 0 ? (initialCents / 100).toFixed(2) : "");
  const [promo, setPromo] = useState(Math.max(feePercent, initialPromo ?? feePercent));
  const [localError, setLocalError] = useState<string>();
  const { priceCents, priceOk } = parsePrice(paid, price);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setLocalError(undefined);
        if (!priceOk) return setLocalError(priceCents > PRICE.max * 100 ? t.errors.priceMax : t.errors.priceMin);
        submit(() => {
          const fd = new FormData();
          fd.set("resourceId", resourceId);
          fd.set("price", paid ? price : "0");
          fd.set("promo", String(promo));
          return fd;
        });
      }}
    >
      <PriceField paid={paid} onPaidChange={setPaid} price={price} onPriceChange={setPrice} feePercent={feePercent} promo={promo} onPromoChange={setPromo} inputClass={inputClass} />
      <SaveBar state={state} pending={pending} note={t.edit.priceText} localError={localError} />
    </form>
  );
}

// Vidéo de présentation YouTube (onglet Images)
export function VideoForm({ resourceId, initial }: { resourceId: string; initial: string }) {
  const { t } = useI18n();
  const { state, pending, submit } = useEditAction(updateResourceVideo);
  const [video, setVideo] = useState(initial);
  const invalid = video.trim() !== "" && !parseYouTubeId(video);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (invalid) return;
        submit(() => {
          const fd = new FormData();
          fd.set("resourceId", resourceId);
          fd.set("video", video.trim());
          return fd;
        });
      }}
    >
      <VideoField value={video} onChange={setVideo} inputClass={inputClass} showLabel={false} />
      <SaveBar state={state} pending={pending} note={t.edit.instantNote} />
    </form>
  );
}

function Field({ id, label, count, help, children }: { id: string; label: string; count?: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {count && <span className="text-xs text-muted">{count}</span>}
      </div>
      {children}
      {help && <p className="mt-1.5 text-xs text-muted">{help}</p>}
    </div>
  );
}
