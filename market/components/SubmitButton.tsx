"use client";

import { useFormStatus } from "react-dom";

// Bouton qui se désactive pendant l'envoi du formulaire
export function SubmitButton({ children, pendingText, className }: { children: React.ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText ?? "…" : children}
    </button>
  );
}
