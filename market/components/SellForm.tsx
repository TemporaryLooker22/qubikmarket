"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { publishResource } from "@/app/actions";
import { ALLOWED_EXTENSIONS, CATEGORIES, MAX_FILE_SIZE, MAX_FORM_SIZE, MAX_IMAGES } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { formatAmount } from "@/lib/i18n/format";
import { scanInBrowser } from "@/lib/scan-client";
import { CategoryIcon } from "./CategoryIcon";
import { FileDrop, type ScanState } from "./sell/FileDrop";
import { ImagePicker, type PickedImage } from "./sell/ImagePicker";
import { DescriptionEditor, DESCRIPTION_MIN } from "./sell/DescriptionEditor";
import { SellAside } from "./sell/SellAside";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[15px] outline-none transition placeholder:text-muted focus:border-text focus:ring-4 focus:ring-accent/30";

// Mêmes limites que le serveur (app/actions.ts)
const TITLE = { min: 4, max: 80 };
const SUMMARY = { min: 10, max: 160 };
const PRICE = { min: 1, max: 500 };

// Formulaire de mise en vente : fichier (scanné dans le navigateur dès le dépôt), informations, images,
// description et prix, avec un aperçu en direct de la carte du catalogue
export function SellForm({ feePercent, username }: { feePercent: number; username: string }) {
  const { t, locale } = useI18n();
  const [state, formAction, pending] = useActionState(publishResource, undefined);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [description, setDescription] = useState("");
  const [paid, setPaid] = useState(true);
  const [price, setPrice] = useState("");
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
    if (picked.size > MAX_FILE_SIZE) return setFileError(t.errors.fileTooBig);
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

  const priceCents = paid ? Math.round((Number(price) || 0) * 100) : 0;
  // Estimation avec la TVA belge (21 %) : le vrai calcul se fait à chaque vente (lib/earnings.ts)
  const taxCents = priceCents - Math.round(priceCents / 1.21);
  const feeCents = Math.round(((priceCents - taxCents) * feePercent) / 100);
  const priceOk = !paid || (priceCents >= PRICE.min * 100 && priceCents <= PRICE.max * 100);

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

  // Envoi : on ajoute le fichier et les images compressées au formulaire.
  // Pas d'action de formulaire directe, pour que React ne vide pas les champs si le serveur renvoie une erreur.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(undefined);
    if (!file) return setLocalError(t.errors.fileMissing);
    if (!category) return setLocalError(t.errors.category);
    if (!priceOk) return setLocalError(priceCents > PRICE.max * 100 ? t.errors.priceMax : t.errors.priceMin);
    const total = file.size + images.reduce((n, i) => n + i.file.size, 0);
    if (total > MAX_FORM_SIZE) return setLocalError(t.errors.formTooBig);

    const formData = new FormData(e.currentTarget);
    formData.set("price", paid ? price : "0");
    formData.set("file", file);
    images.forEach((i) => formData.append("images", i.file));
    startTransition(() => formAction(formData));
  };

  const error = localError ?? state?.error;

  return (
    <form onSubmit={submit} className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {/* 1. Fichier */}
        <Section n={1} done={ready.file} title={t.sell.fileTitle} text={t.sell.fileText}>
          <FileDrop file={file} scan={scan} error={fileError} onFile={chooseFile} />
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
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">{t.sell.fCategory}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CATEGORIES.map((c) => (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/30 ${
                      category === c.id ? "border-text bg-accent-soft ring-1 ring-text ring-inset" : "border-border bg-card hover:border-border-strong"
                    }`}
                  >
                    <input type="radio" name="category" value={c.id} checked={category === c.id} onChange={() => setCategory(c.id)} className="sr-only" />
                    <CategoryIcon category={c.id} className="h-4 w-4 shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Section>

        {/* 3. Images */}
        <Section n={3} done={ready.image} title={t.sell.imagesTitle} text={t.sell.imagesText(MAX_IMAGES)}>
          <ImagePicker images={images} onChange={setImages} />
        </Section>

        {/* 4. Description */}
        <Section n={4} done={ready.description} title={t.sell.descTitle} text={t.sell.descText}>
          <DescriptionEditor value={description} onChange={setDescription} />
        </Section>

        {/* 5. Prix */}
        <Section n={5} done={priceOk && (!paid || price !== "")} title={t.sell.priceTitle} text={t.sell.priceText}>
          <div role="radiogroup" aria-label={t.sell.priceTitle} className="inline-flex gap-1 rounded-xl bg-surface p-1">
            {[false, true].map((isPaid) => (
              <button
                key={String(isPaid)}
                type="button"
                role="radio"
                aria-checked={paid === isPaid}
                onClick={() => setPaid(isPaid)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${paid === isPaid ? "bg-card text-text shadow-sm" : "text-muted hover:text-text"}`}
              >
                {isPaid ? t.sell.paid : t.sell.free}
              </button>
            ))}
          </div>
          {paid ? (
            <>
              <div className="mt-4 flex flex-wrap items-stretch gap-4">
                <div className="relative w-40">
                  <input
                    name="price"
                    type="number"
                    inputMode="decimal"
                    required
                    min={PRICE.min}
                    max={PRICE.max}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="4.99"
                    aria-label={t.sell.priceTitle}
                    className={`${inputClass} h-12 pr-9 text-lg font-bold`}
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 font-semibold text-muted">€</span>
                </div>
                <div className="flex min-w-56 flex-1 flex-col justify-center rounded-xl bg-accent-soft px-4 py-2">
                  <p className="text-lg font-bold">{t.sell.earn(formatAmount(priceCents - taxCents - feeCents, locale))}</p>
                  <p className="text-xs text-text/70">{t.sell.earnDetail(feePercent, formatAmount(taxCents, locale))}</p>
                </div>
              </div>
              <p className="mt-2.5 text-xs text-muted">{t.sell.priceHelp}</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">{t.sell.freeHelp}</p>
          )}
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
              disabled={pending}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent px-7 text-[15px] font-semibold text-text transition hover:-translate-y-px hover:bg-accent-hover disabled:translate-y-0 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Rocket className="h-4 w-4" aria-hidden="true" />}
              {pending ? t.sell.submitting : t.sell.submit}
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
