import Link from "next/link";
import { Wrench } from "lucide-react";

// Page affichée aux visiteurs pendant une maintenance (voir lib/maintenance.ts)
export function MaintenanceScreen({ title, text, message, login }: { title: string; text: string; message: string | null; login: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
        <Wrench className="h-6 w-6 text-text" aria-hidden="true" />
      </span>
      <p className="mb-2 text-sm font-bold tracking-tight">Qubik</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-md text-muted">{text}</p>
      {message && <p className="mt-5 max-w-md whitespace-pre-line rounded-2xl border border-border bg-card px-5 py-4 text-sm">{message}</p>}
      <Link href="/login" className="mt-10 text-xs text-muted hover:text-text hover:underline">
        {login}
      </Link>
    </div>
  );
}
