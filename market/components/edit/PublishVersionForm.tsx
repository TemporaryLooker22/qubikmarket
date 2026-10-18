"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { publishVersion } from "@/app/resource-actions";
import { ALLOWED_EXTENSIONS } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { scanInBrowser } from "@/lib/scan-client";
import { FileDrop, type ScanState } from "@/components/sell/FileDrop";
import { useFileUpload } from "@/components/sell/useFileUpload";
import { inputClass } from "./EditForms";

// « Publier une nouvelle version » : dépôt du fichier (scanné dans le navigateur), numéro et « Quoi de neuf ? »
export function PublishVersionForm({
  resourceId,
  currentVersion,
  suggestion,
  directUpload,
}: {
  resourceId: string;
  currentVersion: string;
  suggestion: string;
  directUpload: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(publishVersion, undefined);
  const upload = useFileUpload(directUpload);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [scan, setScan] = useState<ScanState>({ status: "idle" });
  const [version, setVersion] = useState(suggestion);
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState<string>();

  // Version publiée : on vide le formulaire et on propose le numéro suivant
  useEffect(() => {
    if (!state?.ok) return;
    setFile(null);
    setScan({ status: "idle" });
    setNotes("");
    setVersion(suggestion);
  }, [state, suggestion]);

  // Même vérification et même scan que lors de la mise en vente
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

  // Ce que le résultat du scan va changer pour les acheteurs
  const verdict = scan.status === "done" ? scan.report.verdict : null;
  const outcome =
    verdict === "clean" ? t.edit.scanCleanNew(currentVersion) : verdict === "suspicious" ? t.edit.scanSusNew(currentVersion) : verdict === "dangerous" ? t.edit.scanBadNew(currentVersion) : null;

  const error = localError ?? state?.error;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setLocalError(undefined);
        if (!file) return setLocalError(t.errors.fileMissing);
        const fd = new FormData();
        fd.set("resourceId", resourceId);
        fd.set("version", version.trim());
        fd.set("notes", notes);
        if (!(await upload.attach(file, fd))) return setLocalError(t.errors.uploadFailed);
        startTransition(() => formAction(fd));
      }}
    >
      <FileDrop file={file} scan={scan} error={fileError} onFile={chooseFile} maxMb={upload.maxMb} />
      {outcome && <p className="mt-2 text-sm text-muted">{outcome}</p>}

      <div className="mt-5 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <label htmlFor="version" className="mb-1.5 block text-sm font-semibold">
            {t.edit.versionNumber}
          </label>
          <input id="version" required maxLength={19} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.1" className={inputClass} />
          {suggestion && <p className="mt-1.5 text-xs text-muted">{t.edit.versionHint(suggestion)}</p>}
        </div>
        <div>
          <label htmlFor="notes" className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-semibold">
            {t.edit.notes} <span className="text-xs font-normal text-muted">{t.edit.notesHint}</span>
          </label>
          <textarea
            id="notes"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.edit.notesPh}
            className="block w-full resize-y rounded-lg border border-border bg-card px-3.5 py-2.5 text-[15px] outline-none transition placeholder:text-muted focus:border-text focus:ring-4 focus:ring-accent/30"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        {error ? (
          <p role="alert" className="mr-auto text-sm font-medium text-bad">
            {error}
          </p>
        ) : state?.ok && !pending ? (
          <p role="status" className="mr-auto text-sm font-medium text-ok">
            {state.ok}
          </p>
        ) : (
          <p className="mr-auto text-xs text-muted">{t.edit.buyersNote}</p>
        )}
        <button type="submit" disabled={pending || upload.progress !== null} className="btn-accent rounded-xl px-5 py-2.5 disabled:opacity-60">
          {pending || upload.progress !== null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {upload.progress !== null ? t.sell.uploading(upload.progress) : pending ? t.edit.publishing : t.edit.publish(version.trim())}
        </button>
      </div>
    </form>
  );
}
