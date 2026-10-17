import type { ScanReport } from "@/lib/scan";
import { getDictionary } from "@/lib/i18n/server";

// Affiche le détail du scan (pour le vendeur et les modérateurs)
// Les titres et explications des détections viennent du scanner (en français pour l'instant)
export async function ScanReportView({ report }: { report: ScanReport }) {
  const { t } = await getDictionary();

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
      <p>{t.report.summary(report.scriptCount, report.instanceCount, report.score)}</p>
      {groups.size === 0 && <p>{t.report.noIssue}</p>}
      <ul>
        {[...groups.values()].map((f, i) => (
          <li key={i}>
            <strong>
              [{t.severity[f.severity]}] {f.title}
            </strong>
            <br />
            <code>
              {f.script}
              {f.line ? ` · ${t.report.line(f.line)}` : ""}
              {f.extra ? ` · ${t.report.more(f.extra)}` : ""}
            </code>
            <p>{f.explain}</p>
            <pre>{f.snippet}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
