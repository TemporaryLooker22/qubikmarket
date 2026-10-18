"use client";

import Image from "next/image";
import { Check, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { parseYouTubeId, youTubeThumbnail } from "@/lib/youtube";

// Lien YouTube de la vidéo de présentation (mise en vente et onglet Images) : aperçu de la miniature dès qu'il est valide
export function VideoField({ value, onChange, inputClass, showLabel = true }: { value: string; onChange: (value: string) => void; inputClass: string; showLabel?: boolean }) {
  const { t } = useI18n();
  const id = parseYouTubeId(value);
  const invalid = value.trim() !== "" && !id;

  return (
    <div>
      {showLabel && (
        <label htmlFor="video" className="mb-1.5 block text-sm font-semibold">
          {t.sell.videoLabel}
        </label>
      )}
      <input
        id="video"
        name="video"
        type="url"
        inputMode="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.sell.videoPh}
        aria-invalid={invalid}
        className={`${inputClass} ${invalid ? "border-bad" : ""}`}
      />
      {invalid ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-bad">
          {t.errors.videoInvalid}
        </p>
      ) : id ? (
        <div className="mt-2.5 flex items-center gap-3">
          <span className="relative block aspect-video w-36 shrink-0 overflow-hidden rounded-lg bg-surface">
            <Image src={youTubeThumbnail(id)} alt="" fill sizes="144px" className="object-cover" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-text/70 text-bg">
                <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
              </span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-ok">
            <Check className="h-4 w-4" aria-hidden="true" />
            {t.sell.videoOk}
          </span>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-muted">{t.sell.videoHelp}</p>
      )}
    </div>
  );
}
