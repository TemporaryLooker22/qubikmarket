import type { LucideIcon } from "lucide-react";

// Petits éléments communs aux pages de la modération

export function PageTitle({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="mt-1 text-sm text-muted">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, children, className = "", aside }: { title?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

// Chiffre clé, avec son évolution par rapport à la période d'avant
export function Stat({
  icon: Icon,
  label,
  value,
  note,
  delta,
  dark,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  note?: string;
  delta?: { up: boolean; text: string } | null;
  dark?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${dark ? "border-text bg-text text-bg" : "border-border bg-card"}`}>
      <p className={`flex items-center gap-1.5 text-xs font-semibold ${dark ? "text-bg/65" : "text-muted"}`}>
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 truncate text-2xl font-extrabold tracking-tight">{value}</p>
      {(note || delta) && (
        <p className={`mt-0.5 truncate text-xs ${dark ? "text-bg/65" : "text-muted"}`}>
          {delta && <strong className={delta.up ? (dark ? "text-accent" : "text-ok") : dark ? "text-bg" : "text-bad"}>{delta.text} </strong>}
          {note}
        </p>
      )}
    </div>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "off" | "accent"; children: React.ReactNode }) {
  const styles = { ok: "bg-ok-bg text-ok", warn: "bg-warn-bg text-warn", bad: "bg-bad-bg text-bad", off: "bg-surface text-muted", accent: "bg-accent-soft text-text" };
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${styles[tone]}`}>{children}</span>;
}

// Note IA en une pastille : vert si rien n'est signalé, orange/rouge sinon
export function AiBadge({ status, match, quality, flagged, failedLabel }: { status: string | null; match: number | null; quality: number | null; flagged: boolean | null; failedLabel: string }) {
  if (!status) return null; // pas d'analyse (fichier sans contenu Roblox : image, son, 3D…)
  if (status === "FAILED") return <Badge tone="off">{failedLabel}</Badge>;
  if (status !== "DONE") return <Badge tone="off">IA…</Badge>;
  const low = Math.min(match ?? 0, quality ?? 0);
  return <Badge tone={!flagged ? "ok" : low < 25 ? "bad" : "warn"}>{`IA ${match}/${quality}`}</Badge>;
}
