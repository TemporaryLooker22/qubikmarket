// Tests du scanner : lance avec "node test/run-tests.js"
const fs = require("fs");
const path = require("path");
const { scanFile } = require("../js/scanner.js");

const SAMPLES = path.join(__dirname, "samples");

// Pour chaque échantillon : le verdict attendu et les règles qui doivent être détectées
const EXPECTED = {
  "clean-door.lua": { verdict: "clean", rules: [] },
  "clean-datastore.lua": { verdict: "clean", rules: [] },
  "backdoor-require.lua": { verdict: "dangerous", rules: ["require-asset-id", "hidden-whitespace"] },
  "backdoor-hidden.lua": { verdict: "dangerous", rules: ["require-tonumber", "fenv", "string-char", "studio-check", "self-relocate", "hidden-trigger-combo"] },
  "backdoor-webhook.lua": { verdict: "dangerous", rules: ["discord-webhook", "suspicious-host", "loadstring", "http-service"] },
  "backdoor-obfuscated.lua": { verdict: "dangerous", rules: ["obfuscator-signature", "fenv", "escaped-string"] },
  "virus-plugin.lua": { verdict: "dangerous", rules: ["source-write", "require-asset-id"] },
  "admin-backdoor.lua": { verdict: "dangerous", rules: ["insert-service", "user-id-check", "hidden-trigger-combo"] },
  "infected-model.rbxmx": { verdict: "dangerous", rules: ["require-asset-id", "virus-name"] },
};

let failures = 0;
for (const [file, expected] of Object.entries(EXPECTED)) {
  const report = scanFile(fs.readFileSync(path.join(SAMPLES, file)), file);
  const found = new Set(report.findings.map((f) => f.ruleId));
  const missing = expected.rules.filter((r) => !found.has(r));
  const unexpected = expected.rules.length === 0 ? [...found] : [];
  const ok = report.verdict === expected.verdict && missing.length === 0 && unexpected.length === 0;
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${file.padEnd(26)} ${report.verdict.padEnd(10)} score=${report.score} règles=[${[...found].join(", ")}]`);
  if (missing.length) console.log(`       manquantes : ${missing.join(", ")}`);
  if (unexpected.length) console.log(`       inattendues : ${unexpected.join(", ")}`);
}

console.log(failures ? `\n${failures} test(s) en échec` : "\nTous les tests passent ✅");
process.exit(failures ? 1 : 0);
