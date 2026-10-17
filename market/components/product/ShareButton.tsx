"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

// Copie l'adresse de la page (pratique pour la partager sur Discord)
export function ShareButton({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers refusé par le navigateur : on ne fait rien
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-medium text-muted transition hover:border-border-strong hover:text-text ${className}`}
    >
      {copied ? <Check className="h-4 w-4 text-ok" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? t.resource.copied : t.resource.share}</span>
    </button>
  );
}
