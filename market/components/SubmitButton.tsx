"use client";

import { useFormStatus } from "react-dom";

// Bouton qui se désactive pendant l'envoi du formulaire
export function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn w-full" disabled={pending}>
      {pending ? pendingText ?? "Patiente…" : children}
    </button>
  );
}
