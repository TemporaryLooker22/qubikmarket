import "server-only";

// Le scanner anti-backdoor (le même code que Qubik Scanner)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const scanner = require("./scanner/scanner.js");

export type Severity = "critical" | "high" | "medium" | "low";
export type Verdict = "clean" | "suspicious" | "dangerous";

export type Finding = {
  ruleId: string;
  severity: Severity;
  title: string;
  explain: string;
  script: string;
  line: number | null;
  snippet: string;
};

export type ScanReport = {
  fileName: string;
  format: "binary" | "xml" | "text";
  instanceCount: number;
  scriptCount: number;
  findings: Finding[];
  score: number;
  verdict: Verdict;
};

export function scanFile(bytes: Uint8Array, fileName: string): ScanReport {
  return scanner.scanFile(bytes, fileName);
}
