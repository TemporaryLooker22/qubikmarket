"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PackageCheck, Send, Upload } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { deliverProject, projectStatus, sendProjectMessage } from "@/app/project-actions";
import { useFileUpload } from "@/components/sell/useFileUpload";
import { inputClass } from "@/components/edit/EditForms";

// Page du projet : se rafraîchit toute seule quand il y a du nouveau (message, livraison, paiement…)
export function ProjectLive({ projectId, version }: { projectId: string; version: string }) {
  const router = useRouter();
  const current = useRef(version);
  current.current = version;
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const next = await projectStatus(projectId).catch(() => null);
      if (next && next !== current.current) router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [projectId, router]);
  return null;
}

// Bouton qui demande une confirmation avant d'envoyer son formulaire
export function ConfirmButton({ message, className, children }: { message: string; className: string; children: React.ReactNode }) {
  return (
    <button className={className} onClick={(e) => !confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}

// Nouveau message dans la conversation du projet
export function ProjectComposer({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const s = t.projects;
  const [state, action, pending] = useActionState(sendProjectMessage, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="border-t border-border p-3">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex items-end gap-2">
        <textarea
          name="body"
          required
          maxLength={2000}
          rows={2}
          placeholder={s.messagePlaceholder}
          className={`${inputClass} h-auto min-h-11 flex-1 resize-y py-2.5`}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button disabled={pending} aria-label={s.send} className="btn-accent h-11 shrink-0 rounded-xl px-4 disabled:opacity-60">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {state?.error && <p className="mt-2 text-sm font-semibold text-bad">{state.error}</p>}
    </form>
  );
}

// Livraison du développeur : un fichier (scanné comme les ressources) et un message pour le client
export function DeliverForm({ projectId, directUpload }: { projectId: string; directUpload: boolean }) {
  const { t } = useI18n();
  const s = t.projects;
  const upload = useFileUpload(directUpload);
  const [state, action, pending] = useActionState(deliverProject, undefined);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || upload.progress !== null;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!file) return;
    if (file.size > upload.maxSize) return setError(t.errors.fileTooBig);
    const data = new FormData(e.currentTarget);
    data.delete("pick");
    if (!(await upload.attach(file, data))) return setError(t.errors.uploadFailed);
    startTransition(() => action(data));
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />
      <p className="font-semibold">{s.deliverTitle}</p>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{s.deliverFile}</span>
        <input name="pick" type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface file:px-3 file:py-2 file:font-semibold" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{s.deliverNote}</span>
        <textarea name="note" rows={3} maxLength={2000} className={`${inputClass} h-auto py-2.5`} />
      </label>
      {(error || state?.error) && <p className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">{error ?? state?.error}</p>}
      <button disabled={busy || !file} className="btn-accent h-11 rounded-xl px-5 text-sm disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
        {busy ? (upload.progress !== null ? `${s.delivering} ${Math.round(upload.progress)} %` : s.delivering) : s.deliver}
      </button>
      {state?.ok && (
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok">
          <PackageCheck className="h-4 w-4" aria-hidden="true" /> {s.events.DELIVERED}
        </p>
      )}
    </form>
  );
}
