import type { ScanReport } from "@/lib/scan";

const SEVERITY = {
  critical: { label: "Critique", cls: "bg-bad-bg text-bad" },
  high: { label: "Élevé", cls: "bg-bad-bg text-bad" },
  medium: { label: "Moyen", cls: "bg-warn-bg text-warn" },
  low: { label: "Info", cls: "bg-surface-2 text-muted" },
} as const;

// Affiche le détail du scan (pour le vendeur et les modérateurs)
export function ScanReportView({ report }: { report: ScanReport }) {
  // Regroupe les détections identiques (même règle dans le même script)
  const groups = new Map<string, ScanReport["findings"][number] & { extra: number }>();
  for (const f of report.findings) {
    const key = `${f.ruleId}|${f.script}`;
    const g = groups.get(key);
    if (g) g.extra++;
    else groups.set(key, { ...f, extra: 0 });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {report.scriptCount} script(s) analysé(s) · {report.instanceCount} objet(s) · score de risque {report.score}
      </p>
      {groups.size === 0 && <p className="text-sm text-ok">Aucun problème détecté.</p>}
      <ul className="space-y-3">
        {[...groups.values()].map((f, i) => (
          <li key={i} className="rounded-xl border border-border bg-bg p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${SEVERITY[f.severity].cls}`}>
                {SEVERITY[f.severity].label}
              </span>
              <span className="font-semibold">{f.title}</span>
            </div>
            <p className="mt-1 break-all font-mono text-xs text-muted">
              {f.script}
              {f.line ? ` · ligne ${f.line}` : ""}
              {f.extra ? ` · +${f.extra} autre(s)` : ""}
            </p>
            <p className="mt-1 text-sm text-muted">{f.explain}</p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-2 font-mono text-xs">{f.snippet}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
