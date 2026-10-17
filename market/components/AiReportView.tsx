import { AlertTriangle, BadgeCheck, Check, Clock, Flag, Loader2, X } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { parseAiReport, queueSpots, type QueueSpot } from "@/lib/ai/run";

type Analysis = { id?: string; aiStatus: string | null; aiMatch: number | null; aiQuality: number | null; aiFlagged: boolean | null; aiReport: string | null };

const LEVELS = {
  ok: { Icon: Check, style: "bg-ok-bg text-ok" },
  warn: { Icon: AlertTriangle, style: "bg-warn-bg text-warn" },
  bad: { Icon: X, style: "bg-bad-bg text-bad" },
};

// Résultat de l'analyse IA d'une version : notes, constats et conseils (vendeur), ou constats seuls (modérateur)
export async function AiReportView({ analysis, showTips = true }: { analysis: Analysis; showTips?: boolean }) {
  const { t } = await getDictionary();

  if (!analysis.aiStatus) return null;
  // En file d'attente : sa place et l'attente estimée
  const spot = analysis.id && analysis.aiStatus === "QUEUED" ? (await queueSpots([analysis.id])).get(analysis.id) : undefined;
  if (spot && spot.position > 0) {
    return (
      <div className="rounded-xl bg-bg p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {t.ai.queued}
        </p>
        <p className="mt-1 text-muted">{t.ai.queuedText(spot.position, t.ai.wait(spot.waitSeconds))}</p>
      </div>
    );
  }
  if (analysis.aiStatus === "PENDING" || analysis.aiStatus === "QUEUED") {
    return (
      <div className="rounded-xl bg-bg p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t.ai.running}
        </p>
        <p className="mt-1 text-muted">{t.ai.runningText}</p>
      </div>
    );
  }
  if (analysis.aiStatus === "FAILED") {
    return (
      <div className="rounded-xl bg-bg p-4 text-sm">
        <p className="font-semibold">{t.ai.failed}</p>
        <p className="mt-1 text-muted">{t.ai.failedText}</p>
      </div>
    );
  }

  const report = parseAiReport(analysis.aiReport);
  return (
    <div className="rounded-xl bg-bg p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{t.ai.title}</p>
        {analysis.aiFlagged ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-bold text-warn">
            <Flag className="h-3 w-3" aria-hidden="true" />
            {t.ai.flagged}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2.5 py-0.5 text-xs font-bold text-ok">
            <BadgeCheck className="h-3 w-3" aria-hidden="true" />
            {t.ai.verified}
          </span>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Score label={t.ai.match} value={analysis.aiMatch ?? 0} />
        <Score label={t.ai.quality} value={analysis.aiQuality ?? 0} />
      </div>

      {report?.summary && <p className="mt-3 text-muted">{report.summary}</p>}

      {report && report.findings.length > 0 && (
        <ul className="mt-2 divide-y divide-border">
          {report.findings.map((f, i) => {
            const { Icon, style } = LEVELS[f.level] ?? LEVELS.ok;
            return (
              <li key={i} className="flex gap-2.5 py-2">
                <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${style}`}>
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </span>
                <span>{f.text}</span>
              </li>
            );
          })}
        </ul>
      )}

      {showTips && report && report.tips.length > 0 && (
        <div className="mt-3 rounded-lg bg-accent-soft px-3.5 py-3">
          <p className="mb-1 font-semibold">{t.ai.tips}</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {report.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
      {showTips && <p className="mt-3 text-xs text-muted">{t.ai.disclaimer}</p>}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const color = value >= 60 ? "bg-ok" : value >= 50 ? "bg-accent-hover" : "bg-bad";
  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold">
        {value}
        <span className="text-sm font-semibold text-muted"> / 100</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

// Place dans la file, en une ligne (listes de ressources et historique des versions)
export async function QueueLabel({ spot }: { spot: QueueSpot }) {
  const { t } = await getDictionary();
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
      {spot.position === 0 ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Clock className="h-3 w-3" aria-hidden="true" />}
      {spot.position === 0 ? t.ai.queueRunning : `${t.ai.queueSpot(spot.position)} · ${t.ai.wait(spot.waitSeconds)}`}
    </span>
  );
}
