import type { ScanReport } from "@/lib/scan";
import { getDictionary } from "@/lib/i18n/server";
import { ScanBadge } from "./ScanBadge";

const SEVERITY_STYLES = { critical: "bg-bad text-white", high: "bg-bad-bg text-bad", medium: "bg-warn-bg text-warn", low: "bg-surface text-muted" };

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
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ScanBadge verdict={report.verdict} />
        <span className="text-muted">{t.report.summary(report.scriptCount, report.instanceCount, report.score)}</span>
      </div>
      {groups.size === 0 && <p className="mt-2 text-muted">{t.report.noIssue}</p>}
      <ul className="mt-3 space-y-2">
        {[...groups.values()].map((f, i) => (
          <li key={i} className="rounded-xl border border-border bg-card p-3">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SEVERITY_STYLES[f.severity]}`}>{t.severity[f.severity]}</span>
              {f.title}
            </p>
            <p className="mt-1 truncate font-mono text-xs text-muted">
              {f.script}
              {f.line ? ` · ${t.report.line(f.line)}` : ""}
              {f.extra ? ` · ${t.report.more(f.extra)}` : ""}
            </p>
            <p className="mt-1.5 text-[13px] text-muted">{f.explain}</p>
            {f.snippet && <pre className="mt-2 overflow-x-auto rounded-lg bg-surface px-3 py-2 font-mono text-xs">{f.snippet}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
}
