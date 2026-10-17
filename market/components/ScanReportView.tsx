import type { ScanReport } from "@/lib/scan";

const SEVERITY_LABELS = { critical: "Critique", high: "Élevé", medium: "Moyen", low: "Info" } as const;

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
    <div>
      <p>
        {report.scriptCount} script(s) analysé(s) · {report.instanceCount} objet(s) · score de risque {report.score}
      </p>
      {groups.size === 0 && <p>Aucun problème détecté.</p>}
      <ul>
        {[...groups.values()].map((f, i) => (
          <li key={i}>
            <strong>[{SEVERITY_LABELS[f.severity]}] {f.title}</strong>
            <br />
            <code>
              {f.script}
              {f.line ? ` · ligne ${f.line}` : ""}
              {f.extra ? ` · +${f.extra} autre(s)` : ""}
            </code>
            <p>{f.explain}</p>
            <pre>{f.snippet}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
