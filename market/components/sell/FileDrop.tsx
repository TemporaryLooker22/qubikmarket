"use client";

import { useState } from "react";
import { FileBox, Loader2, RefreshCw, ShieldAlert, ShieldCheck, ShieldX, Upload } from "lucide-react";
import type { ScanReport, Severity } from "@/lib/scan";
import { ALLOWED_EXTENSIONS, FORMAT_GROUPS } from "@/lib/formats";
import { useI18n } from "@/lib/i18n/client";
import { formatSize } from "@/lib/i18n/format";

// Où en est le scan fait dans le navigateur
export type ScanState =
  | { status: "idle" }
  | { status: "scanning" }
  | { status: "done"; report: ScanReport }
  | { status: "failed" }; // fichier illisible ici : le serveur le scannera quand même

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

// Zone de dépôt du fichier vendu (tous les formats acceptés, voir lib/formats.ts), puis résultat du scan anti-backdoor
export function FileDrop({ file, scan, error, onFile, maxMb }: { file: File | null; scan: ScanState; error?: string; onFile: (file: File) => void; maxMb: number }) {
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);

  // Le même champ sert à choisir le premier fichier et à le remplacer
  const picker = (
    <input
      type="file"
      accept={ALLOWED_EXTENSIONS.join(",")}
      className="sr-only"
      onChange={(e) => {
        const picked = e.target.files?.[0];
        if (picked) onFile(picked);
        e.target.value = "";
      }}
    />
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) onFile(dropped);
      }}
    >
      {!file ? (
        <label
          className={`flex cursor-pointer flex-col items-center rounded-2xl border-[1.5px] border-dashed px-6 py-8 text-center transition focus-within:border-text focus-within:ring-4 focus-within:ring-accent/30 ${
            dragging ? "border-text bg-accent-soft" : "border-border-strong bg-bg hover:border-text"
          }`}
        >
          {picker}
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="mt-3 text-[15px] font-semibold">{t.sell.dropTitle}</span>
          <span className="mt-0.5 text-sm text-muted">
            <span className="underline underline-offset-2">{t.sell.dropBrowse}</span> · {t.sell.dropMax(maxMb)}
          </span>
          <span className="mt-3 flex flex-wrap justify-center gap-1.5">
            {/* Un groupe par type de fichier ; les extensions au survol */}
            {FORMAT_GROUPS.map((g) => (
              <span key={g.id} title={g.exts.join(" ")} className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-muted">
                {t.sell.formatGroups[g.id]}
              </span>
            ))}
          </span>
        </label>
      ) : (
        <>
          <div className={`flex items-center gap-3 rounded-xl border p-3 transition ${dragging ? "border-text bg-accent-soft" : "border-border"}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface">
              <FileBox className="h-5 w-5" aria-hidden="true" />
            </span>
            <FileName file={file} scan={scan} />
            <label className="btn-ghost shrink-0 cursor-pointer py-1.5 focus-within:ring-4 focus-within:ring-accent/30">
              {picker}
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t.sell.replace}
            </label>
          </div>
          <ScanResult scan={scan} />
        </>
      )}
      {error && (
        <p role="alert" className="animate-pop mt-3 rounded-lg bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function FileName({ file, scan }: { file: File; scan: ScanState }) {
  const { t, locale } = useI18n();
  const size = formatSize(file.size, locale);
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate font-semibold">{file.name}</p>
      <p className="text-xs text-muted">
        {scan.status !== "done"
          ? size
          : scan.report.fileCount !== undefined
            ? t.sell.fileMetaFiles(size, scan.report.fileCount)
            : t.sell.fileMeta(size, scan.report.scriptCount, scan.report.instanceCount)}
      </p>
    </div>
  );
}

const VERDICT_STYLES = {
  clean: { box: "bg-ok-bg text-ok", dot: "bg-ok", Icon: ShieldCheck },
  suspicious: { box: "bg-warn-bg text-warn", dot: "bg-warn", Icon: ShieldAlert },
  dangerous: { box: "bg-bad-bg text-bad", dot: "bg-bad", Icon: ShieldX },
};

function ScanResult({ scan }: { scan: ScanState }) {
  const { t } = useI18n();

  if (scan.status === "scanning") {
    return (
      <p role="status" className="mt-3 flex items-center gap-2.5 rounded-xl bg-surface px-3.5 py-3 text-sm font-medium">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t.sell.scanning}
      </p>
    );
  }
  if (scan.status === "failed") {
    return <p className="mt-3 rounded-xl bg-surface px-3.5 py-3 text-sm text-muted">{t.sell.scanFailed}</p>;
  }
  if (scan.status !== "done") return null;

  const { report } = scan;
  // Une détection par règle (la plus grave d'abord), comme le calcul du score
  const byRule = new Map<string, ScanReport["findings"][number]>();
  for (const f of report.findings) if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, f);
  const findings = [...byRule.values()].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  const shown = findings.slice(0, 2);

  const style = VERDICT_STYLES[report.verdict];
  const title = { clean: t.sell.scanClean, suspicious: t.sell.scanSuspicious, dangerous: t.sell.scanDangerous }[report.verdict];
  const text = {
    clean: report.fileCount !== undefined && report.scriptCount === 0 ? t.sell.scanCleanMedia : t.sell.scanCleanText(report.scriptCount),
    suspicious: t.sell.scanSuspiciousText(findings.length),
    dangerous: t.sell.scanDangerousText,
  }[report.verdict];

  return (
    <div role="status" className={`animate-pop mt-3 flex gap-3 rounded-xl p-3.5 ${style.box}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${style.dot}`}>
        <style.Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm">{text}</p>
        {/* Détections : les titres viennent du scanner (en français pour l'instant) */}
        {report.verdict !== "clean" &&
          shown.map((f) => (
            <div key={f.ruleId} className="mt-2.5 rounded-lg bg-card/70 px-3 py-2 text-[13px] text-text">
              <p className="font-semibold">
                [{t.severity[f.severity]}] {f.title}
              </p>
              <p className="truncate font-mono text-xs text-muted">
                {f.script}
                {f.line ? ` · ${t.report.line(f.line)}` : ""}
              </p>
            </div>
          ))}
        {report.verdict !== "clean" && findings.length > shown.length && (
          <p className="mt-2 text-xs font-medium">{t.sell.moreFindings(findings.length - shown.length)}</p>
        )}
      </div>
    </div>
  );
}
