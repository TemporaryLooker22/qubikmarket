"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { publishResource } from "@/app/actions";
import { ALLOWED_EXTENSIONS, MAX_FORM_SIZE, MAX_IMAGES } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { scanInBrowser } from "@/lib/scan-client";
import { FileDrop, type ScanState } from "./sell/FileDrop";
import { ImagePicker, type PickedImage } from "./sell/ImagePicker";
import { DescriptionEditor, DESCRIPTION_MIN } from "./sell/DescriptionEditor";
import { SellAside } from "./sell/SellAside";
import { useFileUpload } from "./sell/useFileUpload";
import { VideoField } from "./sell/VideoField";
import { CategoryPicker } from "./sell/CategoryPicker";
import { parsePrice, PRICE, PriceField } from "./sell/PriceField";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[15px] outline-none transition placeholder:text-muted focus:border-text focus:ring-4 focus:ring-accent/30";

// Mêmes limites que le serveur (app/actions.ts)
const TITLE = { min: 4, max: 80 };
const SUMMARY = { min: 10, max: 160 };

// Formulaire de mise en vente : fichier (scanné dans le navigateur dès le dépôt), informations, images,
// description et prix, avec un aperçu en direct de la carte du catalogue
export function SellForm({ feePercent, username, directUpload }: { feePercent: number; username: string; directUpload: boolean }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(publishResource, undefined);
  const upload = useFileUpload(directUpload);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [description, setDescription] = useState("");
  const [video, setVideo] = useState("");
  const [paid, setPaid] = useState(true);
  const [price, setPrice] = useState("");
  // Mise en avant : commission choisie (sa commission normale = pas de mise en avant)
  const [promo, setPromo] = useState(feePercent);
  const [localError, setLocalError] = useState<string>();

  // Libère les aperçus des images quand on quitte la page
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  // Nouveau fichier : vérifications rapides, puis scan dans le navigateur.
  // Si le vendeur change de fichier pendant un scan, le résultat de l'ancien est ignoré.
  const scanId = useRef(0);
  const chooseFile = async (picked: File) => {
    const ext = picked.name.slice(picked.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) return setFileError(t.errors.fileFormat(ALLOWED_EXTENSIONS.join(", ")));
    if (picked.size > upload.maxSize) return setFileError(t.errors.fileTooBig);
    setFileError(undefined);
    setFile(picked);
    setScan({ status: "scanning" });
    const id = ++scanId.current;
    try {
      const report = await scanInBrowser(picked);
      if (id === scanId.current) setScan({ status: "done", report });
    } catch {
      if (id === scanId.current) setScan({ status: "failed" });
    }
  };

  const { priceCents, priceOk } = parsePrice(paid, price);

  // Ce qui est prêt (colonne de droite et pastilles des sections)
  const rejected = scan.status === "done" && scan.report.verdict === "dangerous";
  const ready = {
    file: !!file && (scan.status === "done" || scan.status === "failed") && !rejected,
    title: title.trim().length >= TITLE.min,
    summary: summary.trim().length >= SUMMARY.min,
    category: !!category,
    description: description.trim().length >= DESCRIPTION_MIN,
    image: images.length > 0,
  };

  // Envoi : d'abord le fichier (directement dans le stockage, avec la progression), puis le formulaire
  // avec les images compressées. Pas d'action de formulaire directe, pour que React ne vide pas les champs
  // si le serveur renvoie une erreur.
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(undefined);
    if (!file) return setLocalError(t.errors.fileMissing);
    if (!category) return setLocalError(t.errors.category);
    if (!priceOk) return setLocalError(priceCents > PRICE.max * 100 ? t.errors.priceMax : t.errors.priceMin);
    // En local (sans envoi direct), fichier et images partent avec le formulaire : limite de Vercel
    const total = directUpload ? 0 : file.size + images.reduce((n, i) => n + (i.file?.size ?? 0), 0);
    if (total > MAX_FORM_SIZE) return setLocalError(t.errors.formTooBig);

    const formData = new FormData(e.currentTarget);
    formData.set("price", paid ? price : "0");
    // Images : envoyées directement dans le stockage (jusqu'à 20 Mo chacune), ou avec le formulaire en local
    const newImages = images.flatMap((i) => (i.file ? [i.file] : []));
    if (directUpload) {
      const urls = await upload.uploadImages(newImages);
      if (!urls) return setLocalError(t.errors.uploadFailed);
      urls.forEach((url) => formData.append("imageUrls", url));
    } else {
      newImages.forEach((f) => formData.append("images", f));
    }
    if (!(await upload.attach(file, formData))) return setLocalError(t.errors.uploadFailed);
    startTransition(() => formAction(formData));
  };

  const error = localError ?? state?.error;

  return (
    <form onSubmit={submit} className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {/* 1. Fichier */}
        <Section n={1} done={ready.file} title={t.sell.fileTitle} text={t.sell.fileText}>
          <FileDrop file={file} scan={scan} error={fileError} onFile={chooseFile} maxMb={upload.maxMb} />
        </Section>

        {/* 2. Informations */}
        <Section n={2} done={ready.title && ready.summary && ready.category} title={t.sell.infoTitle} text={t.sell.infoText}>
          <div className="space-y-4">
            <Field id="title" label={t.sell.fTitle} count={`${title.length} / ${TITLE.max}`}>
              <input
                id="title"
                name="title"
                required
                minLength={TITLE.min}
                maxLength={TITLE.max}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t.sell.fTitlePh}
                className={inputClass}
              />
            </Field>
            <Field id="summary" label={t.sell.fSummary} count={`${summary.length} / ${SUMMARY.max}`} help={t.sell.fSummaryHelp}>
              <input
                id="summary"
                name="summary"
                required
                minLength={SUMMARY.min}
                maxLength={SUMMARY.max}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t.sell.fSummaryPh}
                className={inputClass}
              />
            </Field>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
        </Section>

        {/* 3. Images */}
        <Section n={3} done={ready.image} title={t.sell.imagesTitle} text={t.sell.imagesText(MAX_IMAGES)}>
          <ImagePicker images={images} onChange={setImages} direct={directUpload} />
          <div className="mt-5 border-t border-border pt-5">
            <VideoField value={video} onChange={setVideo} inputClass={inputClass} />
          </div>
        </Section>

        {/* 4. Description */}
        <Section n={4} done={ready.description} title={t.sell.descTitle} text={t.sell.descText}>
          <DescriptionEditor value={description} onChange={setDescription} />
        </Section>

        {/* 5. Prix */}
        <Section n={5} done={priceOk && (!paid || price !== "")} title={t.sell.priceTitle} text={t.sell.priceText}>
          <PriceField paid={paid} onPaidChange={setPaid} price={price} onPriceChange={setPrice} feePercent={feePercent} promo={promo} onPromoChange={setPromo} inputClass={inputClass} />
        </Section>

        {/* Publication */}
        <div className="pt-2">
          {error && (
            <p role="alert" className="animate-pop mb-4 rounded-lg bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={pending || upload.progress !== null || upload.imageStep !== null}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-7 text-[15px] font-semibold text-text transition hover:-translate-y-px hover:bg-accent-hover disabled:translate-y-0 disabled:opacity-60"
            >
              {pending || upload.progress !== null || upload.imageStep !== null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Rocket className="h-4 w-4" aria-hidden="true" />}
              {upload.imageStep
                ? t.sell.uploadingImages(upload.imageStep.done, upload.imageStep.total)
                : upload.progress !== null
                  ? t.sell.uploading(upload.progress)
                  : pending
                    ? t.sell.submitting
                    : t.sell.submit}
            </button>
            <p className="min-w-56 flex-1 text-xs text-muted">
              {t.sell.legalStart}
              <Link href="/terms" target="_blank" className="font-medium text-text underline decoration-accent decoration-2 underline-offset-2">
                {t.sell.legalLink}
              </Link>
              {t.sell.legalEnd}
            </p>
          </div>
        </div>
      </div>

      {/* Colonne de droite (en haut sur téléphone) */}
      <div className="order-first lg:order-none">
        <SellAside
          preview={{ title: title.trim(), category, priceCents, paid, image: images[0]?.url, seller: username }}
          checks={[
            { label: t.sell.checks.file, ok: ready.file, note: rejected ? t.sell.rejected : undefined },
            { label: t.sell.checks.title, ok: ready.title },
            { label: t.sell.checks.summary, ok: ready.summary },
            { label: t.sell.checks.category, ok: ready.category },
            { label: t.sell.checks.description, ok: ready.description },
            { label: t.sell.checks.image, ok: ready.image, note: t.sell.recommended },
          ]}
        />
      </div>
    </form>
  );
}

// Une section numérotée du formulaire : la pastille passe en jaune quand elle est remplie
function Section({ n, done, title, text, children }: { n: number; done: boolean; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${done ? "bg-accent" : "bg-surface"}`}
        >
          {n}
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{text}</p>
        </div>
      </div>
      {children}
    </section>
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
